const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const {readMapKitApiKey} = require('./mapkit-env.cjs');
const {readCodePushEnvironment} = require('./codepush-env.cjs');
const {exportedRuntime, RuntimeError} = require('./codepush-runtime.cjs');
const {
  CODE_PUSH_APP_ID,
  CODE_PUSH_BUCKET,
  CODE_PUSH_STORAGE_ORIGIN,
  CODE_PUSH_SIGNATURE_CONTEXT,
  CODE_PUSH_LIMITS,
  parseStrictJson,
  parseManifestPayload,
  parseManifestEnvelope,
  checkManifestCompatibility,
} = require('./codepush-contract.cjs');

const RELEASE_FIELDS = [
  'manifestSequence',
  'releaseId',
  'version',
  'issuedAt',
  'expiresAt',
  'enabled',
  'rolloutBasisPoints',
  'rolloutSeed',
];

class BuildError extends Error {
  constructor(code, field) {
    super(field ? `${code}: ${field}` : code);
    this.code = code;
  }
}

function requireCondition(condition, code, field) {
  if (!condition) throw new BuildError(code, field);
}

function checked(result, code) {
  if (!result.ok) throw new BuildError(code, result.error.field);
  return result.value;
}

function readFile(file, maxBytes, code) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(fd);
    requireCondition(
      stat.isFile() && stat.size > 0 && stat.size <= maxBytes,
      code,
    );
    const bytes = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = fs.readSync(fd, bytes, length, bytes.length - length, null);
      if (count === 0) break;
      length += count;
    }
    requireCondition(length === stat.size, code);
    return bytes.subarray(0, length);
  } catch (error) {
    if (error instanceof BuildError) throw error;
    throw new BuildError(code);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function readObject(file, fields, code) {
  const result = checked(
    parseStrictJson(readFile(file, CODE_PUSH_LIMITS.payloadBytes, code)),
    code,
  );
  requireCondition(
    result !== null && typeof result === 'object' && !Array.isArray(result),
    code,
  );
  requireCondition(
    Object.keys(result).length === fields.length &&
      fields.every(field =>
        Object.prototype.hasOwnProperty.call(result, field),
      ),
    code,
  );
  return result;
}

function packageFor(runtime, sha256, size) {
  const extension = runtime.platform === 'android' ? 'bundle' : 'jsbundle';
  return {
    format: 'bundle',
    url: `${CODE_PUSH_STORAGE_ORIGIN}/${CODE_PUSH_BUCKET}/${runtime.platform}/${runtime.nativeRuntimeId}/releases/${sha256}.${extension}`,
    size,
    sha256,
    entrypoint:
      runtime.platform === 'android' ? 'index.android.bundle' : 'main.jsbundle',
  };
}

function makePayload(runtime, release, packageData) {
  const payload = {
    schemaVersion: 1,
    appId: CODE_PUSH_APP_ID,
    applicationIdentifier: runtime.applicationIdentifier,
    platform: runtime.platform,
    nativeRuntimeId: runtime.nativeRuntimeId,
    minNativeBuild: runtime.nativeBuild,
    maxNativeBuild: runtime.nativeBuild,
    rnVersion: runtime.rnVersion,
    hermesVersion: runtime.hermesVersion,
    bundleFormat: runtime.bundleFormat,
    ...release,
    package: packageData,
    storageContract: runtime.storageContract,
  };
  const result = checked(
    parseManifestPayload(JSON.stringify(payload)),
    'input_invalid',
  );
  checked(checkManifestCompatibility(result, runtime), 'runtime_invalid');
  return result;
}

function signingKey(file, root) {
  try {
    const relative = path.relative(
      fs.realpathSync(root),
      fs.realpathSync(file),
    );
    requireCondition(
      path.isAbsolute(relative) ||
        relative === '..' ||
        relative.startsWith('..' + path.sep),
      'key_invalid',
    );
    const pem = readFile(file, 16 * 1024, 'key_invalid');
    const key = crypto.createPrivateKey({key: pem, format: 'pem'});
    requireCondition(
      key.type === 'private' &&
        key.asymmetricKeyType === 'ec' &&
        key.asymmetricKeyDetails?.namedCurve === 'prime256v1',
      'key_invalid',
    );
    return key;
  } catch {
    // Crypto exceptions can contain input data. Never print the original error.
    throw new BuildError('key_invalid');
  }
}

function productionEnvironment(root, input) {
  requireCondition(
    [undefined, '', 'production'].includes(input.JACO_LARAVEL_API) &&
      [undefined, '', '0'].includes(input.JACO_OFFLINE_MAP_ERROR_PREVIEW),
    'environment_invalid',
  );
  let apiKey;
  try {
    apiKey = readMapKitApiKey({root, env: input});
  } catch {
    throw new BuildError('environment_invalid', 'YAMAP_API_KEY');
  }
  const env = {
    ...input,
    NODE_ENV: 'production',
    BABEL_ENV: 'production',
    CI: '1',
    JACO_LARAVEL_API: 'production',
    JACO_OFFLINE_MAP_ERROR_PREVIEW: '0',
    YAMAP_API_KEY: apiKey,
    SENTRY_DISABLE_AUTO_UPLOAD: 'true',
    SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD: 'true',
  };
  delete env.SENTRY_AUTH_TOKEN;
  for (const name of [
    'CODEPUSH_KEY_ID',
    'CODEPUSH_PRIVATE_KEY_FILE',
    'CODEPUSH_PUBLIC_KEY_FILE',
    'CODEPUSH_TRUSTED_KEYS',
  ])
    delete env[name];
  return env;
}

function runProductionMetro({root, platform, bundlePath, sourceMapPath, env}) {
  const args = [
    path.join(root, 'node_modules/react-native/cli.js'),
    'bundle',
    '--config',
    path.join(root, 'metro.config.js'),
    '--entry-file',
    'index.js',
    '--platform',
    platform,
    '--dev',
    'false',
    '--minify',
    'true',
    '--reset-cache',
    '--max-workers',
    '2',
    '--bundle-output',
    bundlePath,
    '--sourcemap-output',
    sourceMapPath,
    '--assets-dest',
    path.join(path.dirname(bundlePath), 'assets'),
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    shell: false,
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
    maxBuffer: 8 * 1024 * 1024,
  });
  // Metro diagnostics may contain source text and keys. No raw child output is
  // copied into logs or public artifacts, including when bundling fails.
  requireCondition(
    !result.error && result.status === 0 && !result.signal,
    'metro_failed',
  );
}

function sourceJavaScript(bytes) {
  try {
    const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
    requireCondition(text.trim().length > 0, 'bundle_invalid');
    new vm.Script(text, {filename: 'codepush.bundle'}); // Parse only; never execute app code.
    return text;
  } catch {
    throw new BuildError('bundle_invalid');
  }
}

function validateSourceMap(bytes, bundleText) {
  try {
    const map = JSON.parse(
      new TextDecoder('utf-8', {fatal: true}).decode(bytes),
    );
    const strings = value =>
      Array.isArray(value) && value.every(item => typeof item === 'string');
    const validateMap = (item, depth = 0) => {
      requireCondition(
        depth <= CODE_PUSH_LIMITS.jsonDepth &&
          item !== null &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          item.version === 3,
        'sourcemap_invalid',
      );
      // Metro also emits indexed maps. Keep their inline sections intact instead
      // of flattening or fetching external maps, which could change diagnostics.
      if (item.sections !== undefined) {
        requireCondition(
          Array.isArray(item.sections) &&
            item.mappings === undefined &&
            item.sources === undefined,
          'sourcemap_invalid',
        );
        for (const section of item.sections) {
          requireCondition(
            section !== null &&
              typeof section === 'object' &&
              section.url === undefined &&
              section.offset !== null &&
              typeof section.offset === 'object' &&
              Number.isSafeInteger(section.offset.line) &&
              section.offset.line >= 0 &&
              Number.isSafeInteger(section.offset.column) &&
              section.offset.column >= 0,
            'sourcemap_invalid',
          );
          validateMap(section.map, depth + 1);
        }
      } else {
        requireCondition(
          strings(item.sources) &&
            strings(item.names) &&
            typeof item.mappings === 'string',
          'sourcemap_invalid',
        );
        if (item.sourcesContent !== undefined) {
          requireCondition(
            Array.isArray(item.sourcesContent) &&
              item.sourcesContent.length === item.sources.length &&
              item.sourcesContent.every(
                source => source === null || typeof source === 'string',
              ),
            'sourcemap_invalid',
          );
        }
      }
    };
    validateMap(map);
    const debugId = bundleText.match(
      /(?:^|\n)\/\/# debugId=([0-9a-f-]{36})(?:\r?\n|$)/,
    )?.[1];
    if (debugId || map.debug_id !== undefined || map.debugId !== undefined) {
      requireCondition(
        Boolean(debugId) && map.debug_id === debugId && map.debugId === debugId,
        'sourcemap_invalid',
      );
    }
  } catch (error) {
    if (error instanceof BuildError) throw error;
    throw new BuildError('sourcemap_invalid');
  }
}

function writeNew(file, bytes) {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  fs.writeFileSync(file, bytes, {flag: 'wx', mode: 0o600});
}

/** Local preparation only. Supplied runtime metadata is not proof of APK/IPA binding. */
function prepareUpdate(
  options,
  {runMetro = runProductionMetro, packages} = {},
) {
  const root = path.resolve(options.root ?? path.join(__dirname, '..'));
  let settings;
  try {
    settings = readCodePushEnvironment({root, env: options.env ?? process.env});
  } catch {
    throw new BuildError('environment_invalid');
  }
  options = {
    ...options,
    keyFile: options.keyFile ?? settings.CODEPUSH_PRIVATE_KEY_FILE,
    keyId: options.keyId ?? settings.CODEPUSH_KEY_ID,
  };
  requireCondition(
    options.platform === 'android' || options.platform === 'ios',
    'input_invalid',
    'platform',
  );
  for (const field of [
    'runtimeFile',
    'releaseFile',
    'keyFile',
    'outputDirectory',
  ]) {
    requireCondition(
      typeof options[field] === 'string' && options[field].length > 0,
      'input_invalid',
      field,
    );
  }
  checked(
    parseManifestEnvelope(
      JSON.stringify({
        keyId: options.keyId,
        payloadBase64: 'AA==',
        signatureBase64: 'AA==',
      }),
    ),
    'key_id_invalid',
  );
  const runtimeBytes = readFile(
    options.runtimeFile,
    CODE_PUSH_LIMITS.payloadBytes,
    'runtime_invalid',
  );
  let descriptor;
  try {
    descriptor = exportedRuntime(runtimeBytes, {root, packages});
  } catch (error) {
    throw new BuildError(
      error instanceof RuntimeError ? error.code : 'runtime_invalid',
    );
  }
  const runtime = descriptor.runtime;
  const release = readObject(
    options.releaseFile,
    RELEASE_FIELDS,
    'release_invalid',
  );
  requireCondition(
    runtime.platform === options.platform,
    'runtime_invalid',
    'platform',
  );
  const preview = makePayload(
    runtime,
    release,
    packageFor(runtime, '0'.repeat(64), 1),
  );
  let installed;
  try {
    installed = JSON.parse(
      readFile(
        path.join(root, 'node_modules/react-native/package.json'),
        512 * 1024,
        'runtime_invalid',
      ),
    );
    requireCondition(
      installed.version === runtime.rnVersion,
      'runtime_invalid',
      'rnVersion',
    );
    for (const file of ['index.js', 'metro.config.js']) {
      requireCondition(
        fs.statSync(path.join(root, file)).isFile(),
        'input_invalid',
      );
    }
  } catch (error) {
    if (error instanceof BuildError) throw error;
    throw new BuildError('input_invalid');
  }
  const key = signingKey(options.keyFile, root);
  const publicKey = crypto.createPublicKey(key);
  requireCondition(
    Object.hasOwn(descriptor.trustedKeys, options.keyId) &&
      publicKey.export({type: 'spki', format: 'der'}).toString('base64') ===
        descriptor.trustedKeys[options.keyId],
    'key_not_trusted',
  );
  const env = productionEnvironment(root, options.env ?? process.env);
  const out = path.resolve(options.outputDirectory);
  try {
    fs.mkdirSync(out, {mode: 0o700}); // Atomically reserve a new directory; never overwrite.
  } catch (error) {
    throw new BuildError(
      error.code === 'EEXIST' ? 'output_exists' : 'output_invalid',
    );
  }
  try {
    const work = path.join(out, '.work');
    fs.mkdirSync(work, {mode: 0o700});
    const bundlePath = path.join(work, preview.package.entrypoint);
    const sourceMapPath = path.join(work, `${preview.package.entrypoint}.map`);
    try {
      runMetro({
        root,
        platform: runtime.platform,
        bundlePath,
        sourceMapPath,
        env,
      });
    } catch {
      throw new BuildError('metro_failed');
    }
    const bundle = readFile(
      bundlePath,
      CODE_PUSH_LIMITS.packageBytes,
      'bundle_invalid',
    );
    const bundleText = sourceJavaScript(bundle);
    const sourceMap = readFile(
      sourceMapPath,
      256 * 1024 * 1024,
      'sourcemap_invalid',
    );
    validateSourceMap(sourceMap, bundleText);
    try {
      exportedRuntime(runtimeBytes, {root, packages});
    } catch (error) {
      throw new BuildError(
        error instanceof RuntimeError ? error.code : 'runtime_invalid',
      );
    }
    const sha256 = crypto.createHash('sha256').update(bundle).digest('hex');
    const payload = makePayload(
      runtime,
      release,
      packageFor(runtime, sha256, bundle.length),
    );
    const payloadBytes = Buffer.from(JSON.stringify(payload) + '\n', 'utf8');
    checked(parseManifestPayload(payloadBytes), 'input_invalid');
    const signedBytes = Buffer.concat([
      Buffer.from(CODE_PUSH_SIGNATURE_CONTEXT, 'utf8'),
      payloadBytes,
    ]);
    const signature = crypto.sign('sha256', signedBytes, {
      key,
      dsaEncoding: 'der',
    });
    requireCondition(
      crypto.verify(
        'sha256',
        signedBytes,
        {key: publicKey, dsaEncoding: 'der'},
        signature,
      ),
      'signature_invalid',
    );
    const envelope = {
      keyId: options.keyId,
      payloadBase64: payloadBytes.toString('base64'),
      signatureBase64: signature.toString('base64'),
    };
    const envelopeBytes = Buffer.from(JSON.stringify(envelope) + '\n', 'utf8');
    checked(parseManifestEnvelope(envelopeBytes), 'signature_invalid');
    const extension = runtime.platform === 'android' ? 'bundle' : 'jsbundle';
    const name = `${sha256}.${extension}`;
    const publish = path.join(
      out,
      'publish',
      runtime.platform,
      runtime.nativeRuntimeId,
    );
    writeNew(path.join(publish, 'releases', name), bundle);
    writeNew(path.join(out, 'debug', name + '.map'), sourceMap);
    writeNew(path.join(out, 'metadata', 'payload.json'), payloadBytes);
    writeNew(path.join(out, 'metadata', 'runtime.json'), runtimeBytes);
    writeNew(
      path.join(out, 'metadata', 'signing-public-key.pem'),
      publicKey.export({type: 'spki', format: 'pem'}),
    );
    fs.rmSync(work, {recursive: true});
    // The local manifest is the final artifact. No network or publication occurs.
    writeNew(path.join(publish, 'manifest.json'), envelopeBytes);
    return {
      platform: runtime.platform,
      nativeRuntimeId: runtime.nativeRuntimeId,
      packageSha256: sha256,
      size: bundle.length,
      outputDirectory: out,
    };
  } catch (error) {
    fs.rmSync(out, {recursive: true, force: true});
    if (error instanceof BuildError) throw error;
    throw new BuildError('preparation_failed');
  }
}

function parseArguments(argv) {
  const flags = {
    '--platform': 'platform',
    '--runtime': 'runtimeFile',
    '--release': 'releaseFile',
    '--key': 'keyFile',
    '--key-id': 'keyId',
    '--out': 'outputDirectory',
  };
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    const field = Object.prototype.hasOwnProperty.call(flags, argv[i])
      ? flags[argv[i]]
      : undefined;
    requireCondition(
      field &&
        !Object.prototype.hasOwnProperty.call(result, field) &&
        typeof argv[i + 1] === 'string' &&
        argv[i + 1].length > 0 &&
        !argv[i + 1].startsWith('--'),
      'arguments_invalid',
    );
    result[field] = argv[i + 1];
  }
  requireCondition(
    ['platform', 'runtimeFile', 'releaseFile', 'outputDirectory'].every(field =>
      Object.hasOwn(result, field),
    ),
    'arguments_invalid',
  );
  return result;
}

module.exports = {
  prepareUpdate,
  parseArguments,
  runProductionMetro,
  BuildError,
};

if (require.main === module) {
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    console.log(
      'Локальная подготовка CodePush (без публикации):\n' +
        'npm run codepush:build -- --platform android|ios --runtime runtime.json --release release.json ' +
        '--out /path/new-directory [--key /outside-repository/private.pem --key-id KEY_ID]\n' +
        'Ключ и его ID берутся из .env; явные --key/--key-id имеют приоритет.\n' +
        'Runtime JSON экспортируется из готовой APK/IPA/.app: npm run codepush:runtime -- export ARTIFACT OUTPUT.json',
    );
  } else {
    try {
      const result = prepareUpdate(parseArguments(process.argv.slice(2)));
      console.log(
        `CodePush: ${result.platform}, ${result.size} байт, SHA-256 ${result.packageSha256}.`,
      );
      console.log(
        'Бандл и подписанный манифест подготовлены локально. Совместимость с APK/IPA требует проверки нативных метаданных.',
      );
    } catch (error) {
      console.error(
        `CodePush: ${error instanceof BuildError ? error.message : 'preparation_failed'}`,
      );
      process.exitCode = 1;
    }
  }
}
