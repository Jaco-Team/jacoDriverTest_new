const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {readCodePushEnvironment} = require('./codepush-env.cjs');
const {
  parseStrictJson,
  parseManifestPayload,
  checkManifestCompatibility,
} = require('./codepush-contract.cjs');

const RESOURCE = 'codepush-runtime.json';
const HASH = /^[a-f0-9]{64}$/;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const SPKI_PREFIX = Buffer.from(
  '3059301306072a8648ce3d020106082a8648ce3d03010703420004',
  'hex',
);
const IGNORED = new Set([
  '.git',
  '.gradle',
  '.cxx',
  '.kotlin',
  'build',
  'Pods',
  'DerivedData',
  'node_modules',
  'xcuserdata',
  '__tests__',
  '__mocks__',
  'test',
  'tests',
  'example',
  'examples',
]);
const NATIVE =
  /\.(?:c|cc|cpp|cxx|h|hh|hpp|m|mm|swift|kt|kts|java|gradle|cmake|rb|podspec|properties|pro|sh|py|bat|xml|plist|xcconfig|xcprivacy|xcfilelist|xcworkspacedata|modulemap|pch|s|metal|entitlements|storyboard|xib|json|txt|def|a|so|jar|aar|png|jpe?g|webp|gif|svg|ttf|otf)$/i;
const ASSET =
  /\.(?:png|jpe?g|webp|gif|svg|bmp|heic|tiff?|psd|ttf|otf|mp[34]|m4[av]|wav|aac|caf|aiff|mov|webm|pdf|obj|mtl|db)$/i;

class RuntimeError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
function requireCondition(condition, code = 'runtime_invalid') {
  if (!condition) throw new RuntimeError(code);
}
function canonical(value) {
  requireCondition(
    value === null ||
      ['string', 'boolean', 'number', 'object'].includes(typeof value),
  );
  if (typeof value === 'number') requireCondition(Number.isSafeInteger(value));
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map(key => JSON.stringify(key) + ':' + canonical(value[key]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}
function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function parsed(bytes, code = 'runtime_invalid') {
  const result = parseStrictJson(bytes);
  requireCondition(result.ok, code);
  return result.value;
}
function readJson(file) {
  const stat = fs.lstatSync(file);
  requireCondition(stat.isFile() && stat.size > 0 && stat.size <= 512 * 1024);
  return parsed(fs.readFileSync(file));
}
function exact(value, fields) {
  requireCondition(
    value !== null && typeof value === 'object' && !Array.isArray(value),
  );
  requireCondition(
    Object.keys(value).length === fields.length &&
      fields.every(key => Object.hasOwn(value, key)),
  );
}
function nativeVersions(root) {
  const rnVersion = JSON.parse(
    fs.readFileSync(
      path.join(root, 'node_modules/react-native/package.json'),
      'utf8',
    ),
  ).version;
  const hermesVersion = fs
    .readFileSync(
      path.join(
        root,
        'node_modules/react-native/sdks/hermes-engine/version.properties',
      ),
      'utf8',
    )
    .match(/^HERMES_VERSION_NAME=(\S+)$/m)?.[1];
  requireCondition(
    typeof rnVersion === 'string' && typeof hermesVersion === 'string',
  );
  return {rnVersion, hermesVersion};
}
function validateKeys(keys) {
  requireCondition(
    keys !== null &&
      typeof keys === 'object' &&
      !Array.isArray(keys) &&
      Object.keys(keys).length <= 32,
    'trusted_keys_invalid',
  );
  for (const [id, encoded] of Object.entries(keys)) {
    requireCondition(
      KEY_ID.exec(id)?.[0] === id && typeof encoded === 'string',
      'trusted_keys_invalid',
    );
    const bytes = Buffer.from(encoded, 'base64');
    requireCondition(
      bytes.length === 91 &&
        bytes.toString('base64') === encoded &&
        bytes.subarray(0, SPKI_PREFIX.length).equals(SPKI_PREFIX),
      'trusted_keys_invalid',
    );
    try {
      const key = crypto.createPublicKey({
        key: bytes,
        format: 'der',
        type: 'spki',
      });
      requireCondition(
        key.asymmetricKeyType === 'ec' &&
          key.asymmetricKeyDetails?.namedCurve === 'prime256v1',
        'trusted_keys_invalid',
      );
    } catch {
      throw new RuntimeError('trusted_keys_invalid');
    }
  }
  return keys;
}
function readTrustedKeys(file, root) {
  if (!file) return {};
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(file));
  requireCondition(
    relative === '..' ||
      relative.startsWith('..' + path.sep) ||
      path.isAbsolute(relative),
    'trusted_keys_invalid',
  );
  return validateKeys(readJson(file));
}

function nativePackages(root, platform) {
  const config = require('@react-native-community/cli-config').default({
    projectRoot: root,
  });
  const packages = Object.entries(config.dependencies)
    .filter(([, dependency]) => dependency.platforms[platform])
    .map(([name, dependency]) => ({name, root: dependency.root}));
  for (const name of [
    'react-native',
    '@react-native/gradle-plugin',
    '@react-native/codegen',
  ]) {
    const directory = path.join(root, 'node_modules', name);
    if (fs.existsSync(directory)) packages.push({name, root: directory});
  }
  return packages.sort((a, b) => compare(a.name, b.name));
}

/** Hash native sources/configuration only. JS screens and generated outputs are excluded. */
function sourceFingerprint({
  root,
  platform,
  trustedKeys,
  packages = nativePackages(root, platform),
}) {
  const files = new Map();
  const add = (file, label) => {
    const stat = fs.lstatSync(file);
    requireCondition(
      !stat.isSymbolicLink() && stat.isFile(),
      'native_input_invalid',
    );
    files.set(label, digest(fs.readFileSync(file)));
  };
  const walk = (directory, prefix, accept, ignored = IGNORED) => {
    if (!fs.existsSync(directory)) return;
    const directoryStat = fs.lstatSync(directory);
    requireCondition(
      directoryStat.isDirectory() && !directoryStat.isSymbolicLink(),
      'native_input_invalid',
    );
    for (const entry of fs
      .readdirSync(directory, {withFileTypes: true})
      .sort((a, b) => compare(a.name, b.name))) {
      if (
        ignored.has(entry.name) ||
        entry.name.startsWith('.env') ||
        /(?:^local\.properties$|\.keystore$|\.pem$|\.xcuserstate$)/.test(
          entry.name,
        )
      )
        continue;
      const full = path.join(directory, entry.name);
      const label = prefix + '/' + entry.name;
      requireCondition(!entry.isSymbolicLink(), 'native_input_invalid');
      if (entry.isDirectory()) walk(full, label, accept, ignored);
      else if (entry.isFile() && accept(entry.name, label)) add(full, label);
    }
  };
  const optional = (file, label = file) => {
    const full = path.join(root, file);
    if (fs.existsSync(full)) add(full, label);
  };
  const appPackage = path.join(root, 'package.json');
  const appCodegen = fs.existsSync(appPackage)
    ? (JSON.parse(fs.readFileSync(appPackage, 'utf8')).codegenConfig ?? null)
    : null;
  files.set('app/codegenConfig', digest(canonical(appCodegen)));
  for (const config of appCodegen
    ? (appCodegen.libraries ?? [appCodegen])
    : []) {
    if (typeof config.jsSrcsDir !== 'string') continue;
    const directory = path.resolve(root, config.jsSrcsDir);
    const relative = path.relative(root, directory);
    requireCondition(
      relative !== '..' &&
        !relative.startsWith('..' + path.sep) &&
        !path.isAbsolute(relative),
      'native_input_invalid',
    );
    walk(directory, 'app/codegen/' + relative, name => /\.[jt]sx?$/.test(name));
  }
  for (const file of [
    'scripts/codepush-runtime.cjs',
    'scripts/codepush-env.cjs',
    'scripts/codepush-contract.cjs',
    'src/codePush/types.ts',
    'src/codePush/json.ts',
    'src/codePush/validation.ts',
    'react-native.config.js',
    'react-native.config.cjs',
    'scripts/mapkit-env.cjs',
    ...(platform === 'ios'
      ? [
          'scripts/codepush-ios-runtime.cjs',
          'scripts/codepush-ios-runtime.sh',
          'scripts/ios-pods.sh',
          'scripts/ios-bundle.sh',
          'scripts/check-ios-rn-version.cjs',
        ]
      : []),
  ])
    optional(file);
  walk(path.join(root, 'patches'), 'patches', name => name.endsWith('.patch'));
  walk(path.join(root, 'src'), 'src', name => ASSET.test(name));
  walk(
    path.join(root, platform),
    platform,
    (name, label) =>
      NATIVE.test(name) ||
      label.endsWith('/project.pbxproj') ||
      label.endsWith('/Package.resolved') ||
      name === 'gradlew' ||
      name === 'Podfile',
  );
  // Pods is intentionally excluded from the general walk: record its actual lock
  // and local podspec versions without traversing its generated/symlink forest.
  if (platform === 'ios') {
    const lock = fs.readFileSync(path.join(root, 'ios/Podfile.lock'));
    requireCondition(
      lock.equals(fs.readFileSync(path.join(root, 'ios/Pods/Manifest.lock'))),
      'native_lock_mismatch',
    );
    optional('ios/Podfile.lock');
    optional('ios/Pods/Manifest.lock');
    walk(
      path.join(root, 'ios/Pods/Local Podspecs'),
      'ios/Pods/Local Podspecs',
      name => name.endsWith('.json'),
    );
    const pins =
      'ios/jacoDriverTest.xcworkspace/xcshareddata/swiftpm/Package.resolved';
    requireCondition(
      fs.existsSync(path.join(root, pins)),
      'native_lock_mismatch',
    );
    optional(pins);
  }
  for (const dependency of packages) {
    const packageJson = path.join(dependency.root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
    const label = 'native-npm/' + dependency.name;
    add(packageJson, label + '/package.json');
    // Native trees in RN modules are not limited to ios/android (C++ and Apple
    // common code are also inputs). Only native file types are included here.
    walk(dependency.root, label, name => NATIVE.test(name));
    if (dependency.name === '@react-native/codegen')
      walk(dependency.root, label + '/toolchain', name =>
        /\.[cm]?[jt]s$/.test(name),
      );
    if (dependency.name === 'react-native')
      walk(path.join(dependency.root, 'scripts'), label + '/scripts', name =>
        /\.[cm]?[jt]s$/.test(name),
      );
    const configs = pkg.codegenConfig
      ? (pkg.codegenConfig.libraries ?? [pkg.codegenConfig])
      : [];
    for (const config of configs) {
      if (typeof config.jsSrcsDir !== 'string') continue;
      const directory = path.resolve(dependency.root, config.jsSrcsDir);
      const relative = path.relative(dependency.root, directory);
      requireCondition(
        relative !== '..' &&
          !relative.startsWith('..' + path.sep) &&
          !path.isAbsolute(relative),
        'native_input_invalid',
      );
      walk(directory, label + '/codegen/' + relative, name =>
        /\.[jt]sx?$/.test(name),
      );
    }
    // The selected icon font is copied by the native Gradle task.
    if (dependency.name === 'react-native-vector-icons') {
      const font = path.join(dependency.root, 'Fonts/MaterialIcons.ttf');
      if (fs.existsSync(font)) add(font, label + '/Fonts/MaterialIcons.ttf');
    }
  }
  const records = [...files].sort(([a], [b]) => compare(a, b));
  return {
    sourceInputsSha256: digest(canonical({files: records, trustedKeys})),
    fileCount: records.length,
  };
}

function descriptorIdentity(descriptor) {
  const runtime = {...descriptor.runtime};
  delete runtime.nativeRuntimeId;
  return digest(
    canonical({
      schemaVersion: 1,
      runtime,
      sourceInputsSha256: descriptor.sourceInputsSha256,
      buildFacts: descriptor.buildFacts,
      trustedKeys: descriptor.trustedKeys,
    }),
  );
}
function validateRuntime(runtime) {
  exact(runtime, [
    'appId',
    'applicationIdentifier',
    'platform',
    'nativeRuntimeId',
    'nativeBuild',
    'rnVersion',
    'hermesVersion',
    'bundleFormat',
    'storageContract',
  ]);
  const extension = runtime.platform === 'android' ? 'bundle' : 'jsbundle';
  const candidate = parseManifestPayload(
    JSON.stringify({
      schemaVersion: 1,
      appId: runtime.appId,
      applicationIdentifier: runtime.applicationIdentifier,
      platform: runtime.platform,
      nativeRuntimeId: runtime.nativeRuntimeId,
      minNativeBuild: runtime.nativeBuild,
      maxNativeBuild: runtime.nativeBuild,
      rnVersion: runtime.rnVersion,
      hermesVersion: runtime.hermesVersion,
      bundleFormat: runtime.bundleFormat,
      manifestSequence: 1,
      releaseId: 'native-validation',
      version: '1',
      issuedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2099-01-01T00:00:00Z',
      enabled: false,
      rolloutBasisPoints: 0,
      rolloutSeed: 'native-validation',
      package: {
        format: 'bundle',
        url: `https://storage.yandexcloud.net/jaco-driver-codepush/${runtime.platform}/${runtime.nativeRuntimeId}/releases/${'0'.repeat(64)}.${extension}`,
        size: 1,
        sha256: '0'.repeat(64),
        entrypoint:
          runtime.platform === 'android'
            ? 'index.android.bundle'
            : 'main.jsbundle',
      },
      storageContract: runtime.storageContract,
    }),
  );
  requireCondition(
    candidate.ok && checkManifestCompatibility(candidate.value, runtime).ok,
  );
}
function validateDescriptor(
  descriptor,
  {root, verifySources = true, packages} = {},
) {
  exact(descriptor, [
    'schemaVersion',
    'runtime',
    'sourceInputsSha256',
    'buildFacts',
    'trustedKeys',
  ]);
  requireCondition(
    descriptor.schemaVersion === 1 &&
      HASH.exec(descriptor.sourceInputsSha256)?.[0] ===
        descriptor.sourceInputsSha256,
  );
  validateRuntime(descriptor.runtime);
  validateKeys(descriptor.trustedKeys);
  requireCondition(
    descriptor.buildFacts !== null &&
      typeof descriptor.buildFacts === 'object' &&
      !Array.isArray(descriptor.buildFacts),
  );
  for (const field of [
    'platform',
    'applicationIdentifier',
    'nativeBuild',
    'rnVersion',
    'hermesVersion',
  ]) {
    requireCondition(
      descriptor.buildFacts[field] === descriptor.runtime[field],
    );
  }
  requireCondition(
    descriptorIdentity(descriptor) === descriptor.runtime.nativeRuntimeId,
  );
  if (verifySources) {
    const versions = nativeVersions(root);
    requireCondition(
      versions.rnVersion === descriptor.runtime.rnVersion &&
        versions.hermesVersion === descriptor.runtime.hermesVersion,
      'native_inputs_changed',
    );
    const current = sourceFingerprint({
      root,
      platform: descriptor.runtime.platform,
      trustedKeys: descriptor.trustedKeys,
      packages,
    });
    requireCondition(
      current.sourceInputsSha256 === descriptor.sourceInputsSha256,
      'native_inputs_changed',
    );
  }
  return descriptor;
}
function generateDescriptor({root, facts, trustedKeys = {}, packages}) {
  const versions = nativeVersions(root);
  requireCondition(facts.platform === 'android' || facts.platform === 'ios');
  requireCondition(
    facts.rnVersion === versions.rnVersion &&
      facts.hermesVersion === versions.hermesVersion,
    'native_version_mismatch',
  );
  validateKeys(trustedKeys);
  const source = sourceFingerprint({
    root,
    platform: facts.platform,
    trustedKeys,
    packages,
  });
  const descriptor = {
    schemaVersion: 1,
    runtime: {
      appId: 'jaco-driver',
      applicationIdentifier: facts.applicationIdentifier,
      platform: facts.platform,
      nativeRuntimeId: '0'.repeat(64),
      nativeBuild: facts.nativeBuild,
      ...versions,
      bundleFormat: 'js',
      storageContract: {driverOfflineCache: 1, offlineMaps: 1},
    },
    sourceInputsSha256: source.sourceInputsSha256,
    buildFacts: facts,
    trustedKeys,
  };
  descriptor.runtime.nativeRuntimeId = descriptorIdentity(descriptor);
  validateDescriptor(descriptor, {verifySources: false});
  return {descriptor, fileCount: source.fileCount};
}

function exportedRuntime(bytes, {root, packages} = {}) {
  const exported = parsed(bytes);
  exact(exported, ['schemaVersion', 'artifactSha256', 'descriptor']);
  requireCondition(
    exported.schemaVersion === 1 &&
      HASH.exec(exported.artifactSha256)?.[0] === exported.artifactSha256,
  );
  validateDescriptor(exported.descriptor, {root, packages});
  return exported.descriptor;
}
function extractRuntime(artifact, out) {
  const stat = fs.lstatSync(artifact);
  let bytes;
  let artifactSha256;
  if (stat.isDirectory() && artifact.endsWith('.app')) {
    bytes = fs.readFileSync(path.join(artifact, RESOURCE));
    const plist = spawnSync(
      '/usr/libexec/PlistBuddy',
      ['-c', 'Print :CFBundleExecutable', path.join(artifact, 'Info.plist')],
      {encoding: 'utf8'},
    );
    requireCondition(
      plist.status === 0 && /^[A-Za-z0-9._-]+\s*$/.test(plist.stdout),
      'artifact_invalid',
    );
    artifactSha256 = digest(
      fs.readFileSync(path.join(artifact, plist.stdout.trim())),
    );
  } else {
    requireCondition(
      stat.isFile() && /\.(?:apk|ipa)$/.test(artifact),
      'artifact_invalid',
    );
    let member = 'assets/' + RESOURCE;
    if (artifact.endsWith('.ipa')) {
      const listing = spawnSync('unzip', ['-Z1', artifact], {
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      });
      requireCondition(listing.status === 0, 'artifact_invalid');
      const names = listing.stdout
        .split('\n')
        .filter(name =>
          /^Payload\/[^/]+\.app\/codepush-runtime\.json$/.test(name),
        );
      requireCondition(names.length === 1, 'artifact_invalid');
      member = names[0];
    }
    const extracted = spawnSync('unzip', ['-p', artifact, member], {
      maxBuffer: 512 * 1024,
    });
    requireCondition(
      extracted.status === 0 && !extracted.error,
      'artifact_invalid',
    );
    bytes = extracted.stdout;
    artifactSha256 = digest(fs.readFileSync(artifact));
  }
  const descriptor = validateDescriptor(parsed(bytes), {verifySources: false});
  const exported = {schemaVersion: 1, artifactSha256, descriptor};
  fs.writeFileSync(out, canonical(exported) + '\n', {flag: 'wx', mode: 0o600});
  return exported;
}

module.exports = {
  RuntimeError,
  canonical,
  digest,
  readJson,
  nativeVersions,
  validateKeys,
  readTrustedKeys,
  nativePackages,
  sourceFingerprint,
  descriptorIdentity,
  generateDescriptor,
  validateDescriptor,
  exportedRuntime,
  extractRuntime,
};

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const root = path.resolve(__dirname, '..');
    if (args[0] === '--help' && args.length === 1) {
      console.log(
        'CodePush runtime:\n' +
          'generate FACTS.json RESOURCE.json  (native build hook)\n' +
          'export APP.apk|APP.ipa|APP.app NEW-runtime.json\n' +
          'keyring KEY_ID PUBLIC.pem NEW-keyring.json\n' +
          'CODEPUSH_TRUSTED_KEYS points to an external public-key JSON file during the native build.',
      );
    } else if (args[0] === 'keyring' && args.length === 4) {
      const pem = fs.readFileSync(path.resolve(args[2]), 'utf8');
      requireCondition(
        pem.trim().startsWith('-----BEGIN PUBLIC KEY-----'),
        'trusted_keys_invalid',
      );
      const key = crypto.createPublicKey(pem);
      const keys = validateKeys({
        [args[1]]: key.export({type: 'spki', format: 'der'}).toString('base64'),
      });
      fs.writeFileSync(path.resolve(args[3]), canonical(keys) + '\n', {
        flag: 'wx',
        mode: 0o600,
      });
      console.log(
        'CodePush: public keyring prepared; no private key was read or generated.',
      );
    } else if (args[0] === 'export' && args.length === 3) {
      const result = extractRuntime(
        path.resolve(args[1]),
        path.resolve(args[2]),
      );
      console.log(
        `CodePush runtime: ${result.descriptor.runtime.platform}, ${result.descriptor.runtime.nativeRuntimeId}.`,
      );
    } else if (args[0] === 'generate' && args.length === 3) {
      const facts = readJson(path.resolve(args[1]));
      const settings = readCodePushEnvironment({root});
      const trustedKeys = readTrustedKeys(settings.CODEPUSH_TRUSTED_KEYS, root);
      const result = generateDescriptor({root, facts, trustedKeys});
      fs.mkdirSync(path.dirname(path.resolve(args[2])), {recursive: true});
      fs.writeFileSync(
        path.resolve(args[2]),
        canonical(result.descriptor) + '\n',
      );
      console.log(
        `CodePush runtime: ${facts.platform}, ${result.fileCount} native inputs, ${Object.keys(trustedKeys).length} trusted keys.`,
      );
    } else throw new RuntimeError('arguments_invalid');
  } catch (error) {
    console.error(
      `CodePush runtime: ${error instanceof RuntimeError ? error.code : 'runtime_invalid'}`,
    );
    process.exitCode = 1;
  }
}
