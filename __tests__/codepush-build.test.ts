import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  verify,
  type KeyObject,
} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {CodePushPlatform, NativeRuntimeContext} from '@/codePush/types';
import {
  parseManifestEnvelope,
  parseManifestPayload,
} from '@/codePush/validation';

interface BuildOptions {
  root?: string;
  platform: CodePushPlatform;
  runtimeFile: string;
  releaseFile: string;
  keyFile: string;
  keyId: string;
  outputDirectory: string;
  env?: NodeJS.ProcessEnv;
}

type BuildInput = Omit<BuildOptions, 'keyFile' | 'keyId'> &
  Partial<Pick<BuildOptions, 'keyFile' | 'keyId'>>;

interface MetroOptions {
  root: string;
  platform: CodePushPlatform;
  bundlePath: string;
  sourceMapPath: string;
  env: NodeJS.ProcessEnv;
}

interface BuildResult {
  platform: CodePushPlatform;
  nativeRuntimeId: string;
  packageSha256: string;
  size: number;
  outputDirectory: string;
}

interface RuntimeDescriptor {
  schemaVersion: 1;
  runtime: NativeRuntimeContext;
  sourceInputsSha256: string;
  buildFacts: Record<string, unknown>;
  trustedKeys: Record<string, string>;
}

interface ExportedRuntime {
  schemaVersion: 1;
  artifactSha256: string;
  descriptor: RuntimeDescriptor;
}

const {
  prepareUpdate,
  parseArguments,
}: {
  prepareUpdate: (
    options: BuildInput,
    dependencies?: {
      runMetro: (options: MetroOptions) => void;
      packages: never[];
    },
  ) => BuildResult;
  parseArguments: (argv: string[]) => BuildInput;
} = require('../scripts/codepush-build.cjs');

const {
  generateDescriptor,
}: {
  generateDescriptor: (options: {
    root: string;
    facts: Record<string, unknown>;
    trustedKeys: Record<string, string>;
    packages: never[];
  }) => {descriptor: RuntimeDescriptor};
} = require('../scripts/codepush-runtime.cjs');

const runtimeId = 'd'.repeat(64);
const signatureContext = Buffer.from(
  'jaco-driver-codepush-manifest-v1\n',
  'utf8',
);
const debugId = '5f10a7a9-3cdd-4d9f-9f86-28dd59eaa6a1';
// Non-ASCII text checks that byte size is used, rather than JavaScript string length.
const bundleSource = `global.__codePushFixture = 'Привет';\n//# debugId=${debugId}\n`;
const bundleBytes = Buffer.from(bundleSource, 'utf8');
const sourceMap = {
  version: 3,
  file: 'index.android.bundle',
  sources: ['index.js'],
  names: [],
  mappings: 'AAAA',
  sourcesContent: ["global.__codePushFixture = 'Привет';"],
  debug_id: debugId,
  debugId,
};

function exportedRuntime(
  root: string,
  publicKey: KeyObject,
  platform: CodePushPlatform = 'android',
  trustedKeys: Record<string, string> = {
    'courier-key-1': publicKey
      .export({format: 'der', type: 'spki'})
      .toString('base64'),
  },
): ExportedRuntime {
  const {descriptor} = generateDescriptor({
    root,
    facts: {
      applicationIdentifier:
        platform === 'android' ? 'com.jacodrivertest' : 'com.jaco.driver',
      platform,
      nativeBuild: '9007199254740993',
      rnVersion: '0.88.0',
      hermesVersion: '260318099.0.4',
      variant: 'release',
      dependencies: [],
    },
    trustedKeys,
    packages: [],
  });
  return {schemaVersion: 1, artifactSha256: 'f'.repeat(64), descriptor};
}

function createProjectFixture(root: string) {
  const lock = 'PODS:\n  - hermes-engine (260318099.0.4)\n';
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'courier-build-fixture',
      private: true,
    }),
    'node_modules/react-native/package.json': JSON.stringify({
      version: '0.88.0',
    }),
    'node_modules/react-native/sdks/hermes-engine/version.properties':
      'HERMES_VERSION_NAME=260318099.0.4\n',
    'index.js': 'global.fixture = true;',
    'metro.config.js': 'module.exports = {};',
    'android/app/build.gradle': 'android { namespace "com.jacodrivertest" }\n',
    'ios/Podfile.lock': lock,
    'ios/Pods/Manifest.lock': lock,
    'ios/jacoDriverTest.xcworkspace/xcshareddata/swiftpm/Package.resolved':
      JSON.stringify({pins: [], version: 3}),
  };
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, contents);
  }
}

function release() {
  return {
    manifestSequence: 7,
    releaseId: 'courier-7',
    version: '1.0.7',
    issuedAt: '2026-01-01T00:00:00Z',
    expiresAt: '2099-01-01T00:00:00Z',
    enabled: true,
    rolloutBasisPoints: 10000,
    rolloutSeed: 'courier-rollout-1',
  };
}

function writeJson(filename: string, value: unknown) {
  fs.writeFileSync(filename, JSON.stringify(value));
}

function writeMetroFiles(options: MetroOptions) {
  fs.writeFileSync(options.bundlePath, bundleBytes);
  writeJson(options.sourceMapPath, {
    ...sourceMap,
    file:
      options.platform === 'android' ? 'index.android.bundle' : 'main.jsbundle',
  });
}

function indexedSourceMap(section: Record<string, unknown> = {}) {
  return {
    version: 3,
    sections: [{offset: {line: 0, column: 0}, map: sourceMap, ...section}],
    debug_id: debugId,
    debugId,
  };
}

function nestedSourceMap(depth: number): Record<string, unknown> {
  let map: Record<string, unknown> = sourceMap;
  for (let level = 0; level < depth; level += 1) {
    map = {version: 3, sections: [{offset: {line: 0, column: 0}, map}]};
  }
  return {...map, debug_id: debugId, debugId};
}

function collectFiles(directory: string, relative = ''): string[] {
  return fs
    .readdirSync(path.join(directory, relative), {withFileTypes: true})
    .flatMap(entry => {
      const filename = path.join(relative, entry.name);
      return entry.isDirectory()
        ? collectFiles(directory, filename)
        : [filename];
    })
    .sort();
}

function expectFailure(operation: () => unknown, codes: string | string[]) {
  let failure: unknown;
  try {
    operation();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  const error = failure as Error & {code: string};
  expect(Array.isArray(codes) ? codes : [codes]).toContain(error.code);
  expect(error.message).not.toContain('BEGIN PRIVATE KEY');
  expect(error.message).not.toContain('PRIVATE_KEY_SENTINEL');
  return error;
}

describe('CodePush local bundle preparation', () => {
  let directory: string;
  let projectRoot: string;
  let options: BuildOptions;
  let privateKeyPem: string;
  let publicKey: KeyObject;

  beforeAll(() => {
    const keys = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
    privateKeyPem = keys.privateKey
      .export({format: 'pem', type: 'pkcs8'})
      .toString();
    publicKey = keys.publicKey;
  });

  beforeEach(() => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'jaco-codepush-build-test-'),
    );
    projectRoot = path.join(directory, 'project');
    createProjectFixture(projectRoot);
    options = {
      root: projectRoot,
      platform: 'android',
      runtimeFile: path.join(directory, 'runtime.json'),
      releaseFile: path.join(directory, 'release.json'),
      keyFile: path.join(directory, 'private.pem'),
      keyId: 'courier-key-1',
      outputDirectory: path.join(directory, 'output'),
      env: {
        YAMAP_API_KEY: 'test-mapkit-key',
        NODE_ENV: 'test',
        BABEL_ENV: 'test',
      },
    };
    writeJson(options.runtimeFile, exportedRuntime(projectRoot, publicKey));
    writeJson(options.releaseFile, release());
    fs.writeFileSync(options.keyFile, privateKeyPem, {mode: 0o600});
  });

  afterEach(() => {
    fs.rmSync(directory, {recursive: true, force: true});
  });

  it.each<CodePushPlatform>(['android', 'ios'])(
    'prepares and independently verifies a %s update',
    platform => {
      options.platform = platform;
      const nativeArtifactRuntime = exportedRuntime(
        projectRoot,
        publicKey,
        platform,
      );
      const nativeRuntime = nativeArtifactRuntime.descriptor.runtime;
      const nativeRuntimeId = nativeRuntime.nativeRuntimeId;
      writeJson(options.runtimeFile, nativeArtifactRuntime);
      const runMetro = jest.fn(writeMetroFiles);
      const result = prepareUpdate(options, {runMetro, packages: []});
      const extension = platform === 'android' ? 'bundle' : 'jsbundle';
      const sha256 = createHash('sha256').update(bundleBytes).digest('hex');
      const runtimePath = `publish/${platform}/${nativeRuntimeId}`;
      const packagePath = `${runtimePath}/releases/${sha256}.${extension}`;
      const manifestPath = path.join(
        result.outputDirectory,
        runtimePath,
        'manifest.json',
      );
      const payloadBytes = fs.readFileSync(
        path.join(result.outputDirectory, 'metadata/payload.json'),
      );
      const envelope = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const payload = JSON.parse(payloadBytes.toString('utf8'));
      const {nativeBuild, ...runtimeFields} = nativeRuntime;
      const signature = Buffer.from(envelope.signatureBase64, 'base64');
      const signedBytes = Buffer.concat([signatureContext, payloadBytes]);

      expect(result).toMatchObject({
        platform,
        nativeRuntimeId,
        packageSha256: sha256,
        size: bundleBytes.length,
        outputDirectory: options.outputDirectory,
      });
      expect(runMetro).toHaveBeenCalledTimes(1);
      expect(
        fs.readFileSync(path.join(result.outputDirectory, packagePath)),
      ).toEqual(bundleBytes);
      expect(collectFiles(result.outputDirectory)).toEqual(
        [
          `debug/${sha256}.${extension}.map`,
          'metadata/payload.json',
          'metadata/runtime.json',
          'metadata/signing-public-key.pem',
          `${runtimePath}/manifest.json`,
          packagePath,
        ].sort(),
      );
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(result.outputDirectory, 'metadata/runtime.json'),
            'utf8',
          ),
        ),
      ).toEqual(nativeArtifactRuntime);
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(
              result.outputDirectory,
              `debug/${sha256}.${extension}.map`,
            ),
            'utf8',
          ),
        ),
      ).toMatchObject({version: 3, debug_id: debugId});
      expect(
        parseManifestEnvelope(fs.readFileSync(manifestPath)),
      ).toMatchObject({ok: true});
      expect(parseManifestPayload(payloadBytes)).toMatchObject({ok: true});
      expect(Buffer.from(envelope.payloadBase64, 'base64')).toEqual(
        payloadBytes,
      );
      expect(envelope.keyId).toBe(options.keyId);
      expect(payload).toMatchObject({
        ...release(),
        ...runtimeFields,
        minNativeBuild: nativeBuild,
        maxNativeBuild: nativeBuild,
        package: {
          format: 'bundle',
          entrypoint:
            platform === 'android' ? 'index.android.bundle' : 'main.jsbundle',
          sha256,
          size: bundleBytes.length,
          url: `https://storage.yandexcloud.net/jaco-driver-codepush/${platform}/${nativeRuntimeId}/releases/${sha256}.${extension}`,
        },
      });
      expect(payload).not.toHaveProperty('nativeBuild');
      expect(payload).not.toHaveProperty('trusted');
      expect(payload.package).not.toHaveProperty('files');
      expect(signature[0]).toBe(0x30); // ASN.1 sequence, independently verified as DER below.
      expect(signature.length).toBeLessThanOrEqual(72);
      expect(
        verify(
          'sha256',
          signedBytes,
          {key: publicKey, dsaEncoding: 'der'},
          signature,
        ),
      ).toBe(true);

      const exportedPublicKey = createPublicKey(
        fs.readFileSync(
          path.join(result.outputDirectory, 'metadata/signing-public-key.pem'),
        ),
      );
      expect(exportedPublicKey.export({format: 'der', type: 'spki'})).toEqual(
        publicKey.export({format: 'der', type: 'spki'}),
      );
      expect(verify('sha256', signedBytes, exportedPublicKey, signature)).toBe(
        true,
      );
      expect(
        verify(
          'sha256',
          Buffer.concat([Buffer.from('other-context\n'), payloadBytes]),
          publicKey,
          signature,
        ),
      ).toBe(false);
      expect(
        verify(
          'sha256',
          Buffer.concat([signatureContext, payloadBytes, Buffer.from(' ')]),
          publicKey,
          signature,
        ),
      ).toBe(false);
      const wrongKey = generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
      }).publicKey;
      expect(verify('sha256', signedBytes, wrongKey, signature)).toBe(false);
      const tampered = Buffer.from(signature);
      tampered[tampered.length - 1] ^= 1;
      expect(verify('sha256', signedBytes, publicKey, tampered)).toBe(false);
      expect(fs.readFileSync(options.keyFile, 'utf8')).toBe(privateKeyPem);
    },
  );

  it('uses a production child environment without mutating the caller environment', () => {
    options.env = {
      ...options.env,
      CODEPUSH_PRIVATE_KEY_FILE: options.keyFile,
      CODEPUSH_PUBLIC_KEY_FILE: '/outside/public.pem',
      CODEPUSH_TRUSTED_KEYS: '/outside/trusted-keys.json',
      CODEPUSH_KEY_ID: options.keyId,
    };
    const suppliedEnv = {...options.env};
    const runMetro = jest.fn(writeMetroFiles);
    prepareUpdate(options, {runMetro, packages: []});

    expect(runMetro.mock.calls[0][0]).toMatchObject({
      root: projectRoot,
      platform: 'android',
      env: {
        NODE_ENV: 'production',
        BABEL_ENV: 'production',
        YAMAP_API_KEY: 'test-mapkit-key',
        SENTRY_DISABLE_AUTO_UPLOAD: 'true',
        SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD: 'true',
      },
    });
    for (const name of [
      'CODEPUSH_PRIVATE_KEY_FILE',
      'CODEPUSH_PUBLIC_KEY_FILE',
      'CODEPUSH_TRUSTED_KEYS',
      'CODEPUSH_KEY_ID',
    ]) {
      expect(runMetro.mock.calls[0][0].env).not.toHaveProperty(name);
    }
    expect(options.env).toEqual(suppliedEnv);
  });

  it('signs using paths and key ID from .env when options omit them', () => {
    fs.writeFileSync(
      path.join(projectRoot, '.env'),
      `CODEPUSH_KEY_ID=${options.keyId}\nCODEPUSH_PRIVATE_KEY_FILE="${options.keyFile}"\n`,
    );
    const input: BuildInput = {...options};
    delete input.keyFile;
    delete input.keyId;

    const result = prepareUpdate(input, {
      runMetro: writeMetroFiles,
      packages: [],
    });
    const runtime = JSON.parse(
      fs.readFileSync(options.runtimeFile, 'utf8'),
    ) as ExportedRuntime;
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(
          result.outputDirectory,
          'publish/android',
          runtime.descriptor.runtime.nativeRuntimeId,
          'manifest.json',
        ),
        'utf8',
      ),
    ) as {keyId: string; payloadBase64: string; signatureBase64: string};
    expect(manifest.keyId).toBe(options.keyId);
    expect(
      verify(
        'sha256',
        Buffer.concat([
          signatureContext,
          Buffer.from(manifest.payloadBase64, 'base64'),
        ]),
        publicKey,
        Buffer.from(manifest.signatureBase64, 'base64'),
      ),
    ).toBe(true);
    expect(input).not.toHaveProperty('keyFile');
  });

  it('lets explicit signing options override conflicting .env settings', () => {
    fs.writeFileSync(
      path.join(projectRoot, '.env'),
      'CODEPUSH_KEY_ID=wrong-key\nCODEPUSH_PRIVATE_KEY_FILE=/missing/private.pem\n',
    );
    expect(
      prepareUpdate(options, {runMetro: writeMetroFiles, packages: []}),
    ).toHaveProperty('packageSha256');
  });

  it.each([
    ['JACO_LARAVEL_API', 'local'],
    ['JACO_LARAVEL_API', 'typo'],
    ['JACO_OFFLINE_MAP_ERROR_PREVIEW', '1'],
    ['JACO_OFFLINE_MAP_ERROR_PREVIEW', 'true'],
  ])('rejects unsafe inherited %s=%s before Metro', (name, value) => {
    const runMetro = jest.fn(writeMetroFiles);
    options.env = {...options.env, [name]: value};

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      'environment_invalid',
    );
    expect(runMetro).not.toHaveBeenCalled();
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it('accepts explicit production API and disabled preview values', () => {
    options.env = {
      ...options.env,
      JACO_LARAVEL_API: 'production',
      JACO_OFFLINE_MAP_ERROR_PREVIEW: '0',
    };
    expect(
      prepareUpdate(options, {runMetro: writeMetroFiles, packages: []}),
    ).toHaveProperty('packageSha256');
  });

  it.each([
    ['unknown-field', {unexpected: 'value'}],
    ['numeric-build', {nativeBuild: 42}],
    ['other-app', {appId: 'jaco-client'}],
    ['wrong-platform', {platform: 'ios'}],
    ['invalid-runtime-id', {nativeRuntimeId: 'rn-0.88.0'}],
    ['different-installed-rn', {rnVersion: '0.87.1'}],
  ])('rejects tampered bound runtime metadata: %s', (_name, overrides) => {
    const value = exportedRuntime(projectRoot, publicKey);
    Object.assign(value.descriptor.runtime, overrides);
    writeJson(options.runtimeFile, value);
    const runMetro = jest.fn(writeMetroFiles);

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      ['runtime_invalid', 'input_invalid'],
    );
    expect(runMetro).not.toHaveBeenCalled();
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it('rejects a plain runtime context without native artifact provenance', () => {
    writeJson(
      options.runtimeFile,
      exportedRuntime(projectRoot, publicKey).descriptor.runtime,
    );
    const runMetro = jest.fn(writeMetroFiles);

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      'runtime_invalid',
    );
    expect(runMetro).not.toHaveBeenCalled();
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it('rejects a valid artifact runtime exported for the other platform', () => {
    writeJson(
      options.runtimeFile,
      exportedRuntime(projectRoot, publicKey, 'ios'),
    );
    const runMetro = jest.fn(writeMetroFiles);

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      'runtime_invalid',
    );
    expect(runMetro).not.toHaveBeenCalled();
  });

  it('rejects native source changes made after the artifact runtime was generated', () => {
    fs.appendFileSync(
      path.join(projectRoot, 'android/app/build.gradle'),
      '\n// Changed native configuration\n',
    );
    const runMetro = jest.fn(writeMetroFiles);

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      'native_inputs_changed',
    );
    expect(runMetro).not.toHaveBeenCalled();
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it('allows JavaScript-only changes against the same native artifact', () => {
    fs.writeFileSync(
      path.join(projectRoot, 'index.js'),
      'global.fixture = "updated JS";',
    );

    expect(
      prepareUpdate(options, {runMetro: writeMetroFiles, packages: []}),
    ).toHaveProperty('packageSha256');
  });

  it('refuses native inputs changed while Metro runs and removes the unfinished update', () => {
    const runMetro = (metroOptions: MetroOptions) => {
      writeMetroFiles(metroOptions);
      fs.appendFileSync(
        path.join(projectRoot, 'android/app/build.gradle'),
        '\n// Changed during bundling\n',
      );
    };

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      'native_inputs_changed',
    );
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it.each(['empty-keyring', 'unknown-key-id', 'different-public-key'])(
    'rejects a signing key not pinned in the native artifact: %s',
    kind => {
      if (kind === 'empty-keyring') {
        writeJson(
          options.runtimeFile,
          exportedRuntime(projectRoot, publicKey, 'android', {}),
        );
      } else if (kind === 'unknown-key-id') {
        options.keyId = 'other-key';
      } else {
        const otherKey = generateKeyPairSync('ec', {
          namedCurve: 'prime256v1',
        }).publicKey;
        writeJson(
          options.runtimeFile,
          exportedRuntime(projectRoot, publicKey, 'android', {
            'courier-key-1': otherKey
              .export({format: 'der', type: 'spki'})
              .toString('base64'),
          }),
        );
      }
      const runMetro = jest.fn(writeMetroFiles);

      expectFailure(
        () => prepareUpdate(options, {runMetro, packages: []}),
        'key_not_trusted',
      );
      expect(runMetro).not.toHaveBeenCalled();
      expect(fs.existsSync(options.outputDirectory)).toBe(false);
    },
  );

  it.each([
    ['runtime-override', {...release(), nativeRuntimeId: runtimeId}],
    [
      'package-override',
      {...release(), package: {url: 'https://other.example/bundle'}},
    ],
    ['fractional-sequence', {...release(), manifestSequence: 1.5}],
    ['reversed-dates', {...release(), expiresAt: '2025-01-01T00:00:00Z'}],
    ['invalid-rollout', {...release(), rolloutBasisPoints: 10001}],
  ])('rejects invalid release metadata: %s', (_name, value) => {
    writeJson(options.releaseFile, value);
    const runMetro = jest.fn(writeMetroFiles);

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      ['release_invalid', 'input_invalid'],
    );
    expect(runMetro).not.toHaveBeenCalled();
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it.each([
    '{"manifestSequence":7,"manifestSequence":8}',
    JSON.stringify(release()).replace(
      '"manifestSequence":7',
      '"manifestSequence":1e0',
    ),
    JSON.stringify(release()).replace(
      '"manifestSequence":7',
      '"manifestSequence":9007199254740993',
    ),
  ])(
    'rejects duplicate or noncanonical numeric JSON rather than normalizing it',
    source => {
      fs.writeFileSync(options.releaseFile, source);
      expectFailure(
        () => prepareUpdate(options, {runMetro: writeMetroFiles, packages: []}),
        ['release_invalid', 'input_invalid'],
      );
      expect(fs.existsSync(options.outputDirectory)).toBe(false);
    },
  );

  it('rejects invalid UTF-8 in runtime JSON', () => {
    fs.writeFileSync(
      options.runtimeFile,
      Buffer.from([0x22, 0xc0, 0xaf, 0x22]),
    );
    expectFailure(
      () => prepareUpdate(options, {runMetro: writeMetroFiles, packages: []}),
      ['runtime_invalid', 'input_invalid'],
    );
  });

  it('rejects missing input files without returning raw filesystem errors', () => {
    fs.unlinkSync(options.runtimeFile);
    expectFailure(
      () => prepareUpdate(options, {runMetro: writeMetroFiles, packages: []}),
      ['runtime_invalid', 'input_invalid'],
    );
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it.each(['../key', 'with spaces', ''])(
    'rejects invalid signing key identifier %s',
    keyId => {
      options.keyId = keyId;
      expectFailure(
        () => prepareUpdate(options, {runMetro: writeMetroFiles, packages: []}),
        'key_id_invalid',
      );
    },
  );

  it.each(['rsa', 'p384', 'public-only', 'encrypted', 'corrupt'])(
    'rejects an unsupported %s signing key',
    kind => {
      let pem: string;
      if (kind === 'rsa') {
        pem = generateKeyPairSync('rsa', {modulusLength: 2048})
          .privateKey.export({type: 'pkcs8', format: 'pem'})
          .toString();
      } else if (kind === 'p384') {
        pem = generateKeyPairSync('ec', {namedCurve: 'secp384r1'})
          .privateKey.export({type: 'pkcs8', format: 'pem'})
          .toString();
      } else if (kind === 'public-only') {
        pem = publicKey.export({type: 'spki', format: 'pem'}).toString();
      } else if (kind === 'encrypted') {
        pem = generateKeyPairSync('ec', {namedCurve: 'prime256v1'})
          .privateKey.export({
            type: 'pkcs8',
            format: 'pem',
            cipher: 'aes-256-cbc',
            passphrase: 'PRIVATE_KEY_SENTINEL',
          })
          .toString();
      } else {
        pem = 'PRIVATE_KEY_SENTINEL';
      }
      fs.writeFileSync(options.keyFile, pem);
      const runMetro = jest.fn(writeMetroFiles);

      expectFailure(
        () => prepareUpdate(options, {runMetro, packages: []}),
        'key_invalid',
      );
      expect(runMetro).not.toHaveBeenCalled();
      expect(fs.existsSync(options.outputDirectory)).toBe(false);
    },
  );

  it('rejects a private key inside the project without removing the key', () => {
    options.keyFile = path.join(projectRoot, 'private.pem');
    fs.writeFileSync(options.keyFile, privateKeyPem, {mode: 0o600});
    const runMetro = jest.fn(writeMetroFiles);

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      'key_invalid',
    );
    expect(runMetro).not.toHaveBeenCalled();
    expect(fs.readFileSync(options.keyFile, 'utf8')).toBe(privateKeyPem);
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it.each(['directory', 'file'])(
    'preserves an existing output %s and all its data',
    kind => {
      if (kind === 'directory') {
        fs.mkdirSync(options.outputDirectory);
        fs.writeFileSync(
          path.join(options.outputDirectory, 'sentinel.txt'),
          'existing release',
        );
      } else {
        fs.writeFileSync(options.outputDirectory, 'existing release');
      }
      const runMetro = jest.fn(writeMetroFiles);
      expectFailure(
        () => prepareUpdate(options, {runMetro, packages: []}),
        'output_exists',
      );
      expect(runMetro).not.toHaveBeenCalled();
      const sentinel =
        kind === 'directory'
          ? path.join(options.outputDirectory, 'sentinel.txt')
          : options.outputDirectory;
      expect(fs.readFileSync(sentinel, 'utf8')).toBe('existing release');
    },
  );

  it('cleans partial artifacts after Metro fails without exposing its raw error', () => {
    const before = fs.readdirSync(directory).sort();
    const runMetro = (metroOptions: MetroOptions) => {
      fs.writeFileSync(metroOptions.bundlePath, bundleBytes);
      throw new Error('PRIVATE_KEY_SENTINEL from child process');
    };

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      'metro_failed',
    );
    expect(fs.readdirSync(directory).sort()).toEqual(before);
    expect(fs.readFileSync(options.keyFile, 'utf8')).toBe(privateKeyPem);
  });

  it.each([
    ['empty', Buffer.alloc(0)],
    ['whitespace-only', Buffer.from(' \n\t')],
    ['ZIP', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x61])],
    ['Hermes-bytecode', Buffer.from('c61fbc03c103191f', 'hex')],
    ['invalid-UTF8', Buffer.from([0xc0, 0xaf])],
    ['invalid-JavaScript', Buffer.from('global.fixture = ;')],
  ])(
    'rejects %s bundle output and removes partial artifacts',
    (_name, bytes) => {
      const before = fs.readdirSync(directory).sort();
      const runMetro = (metroOptions: MetroOptions) => {
        writeMetroFiles(metroOptions);
        fs.writeFileSync(metroOptions.bundlePath, bytes);
      };

      expectFailure(
        () => prepareUpdate(options, {runMetro, packages: []}),
        'bundle_invalid',
      );
      expect(fs.readdirSync(directory).sort()).toEqual(before);
    },
  );

  it('parses bundle syntax without executing application code', () => {
    const runMetro = (metroOptions: MetroOptions) => {
      fs.writeFileSync(
        metroOptions.bundlePath,
        'throw new Error("This bundle must not execute");',
      );
      writeJson(metroOptions.sourceMapPath, {
        version: 3,
        sources: ['index.js'],
        names: [],
        mappings: 'AAAA',
      });
    };

    expect(prepareUpdate(options, {runMetro, packages: []})).toHaveProperty(
      'packageSha256',
    );
  });

  it('rejects a missing bundle instead of completing a release', () => {
    const runMetro = (metroOptions: MetroOptions) => {
      writeJson(metroOptions.sourceMapPath, sourceMap);
    };

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      'bundle_invalid',
    );
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it('rejects a bundle larger than the protocol limit', () => {
    const runMetro = (metroOptions: MetroOptions) => {
      writeMetroFiles(metroOptions);
      fs.truncateSync(metroOptions.bundlePath, 128 * 1024 * 1024 + 1);
    };

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      'bundle_invalid',
    );
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it.each([
    ['unsupported-version', {...sourceMap, version: 2}],
    ['invalid-sources', {...sourceMap, sources: [42]}],
    ['invalid-names', {...sourceMap, names: [false]}],
    ['invalid-mappings', {...sourceMap, mappings: []}],
    ['wrong-sources-content-length', {...sourceMap, sourcesContent: []}],
    ['invalid-sources-content', {...sourceMap, sourcesContent: [false]}],
    [
      'mismatched-debug-id',
      {...sourceMap, debug_id: '7a017b2a-951e-47de-83f9-868456b25f91'},
    ],
  ])('rejects %s sourcemap output', (_name, value) => {
    const runMetro = (metroOptions: MetroOptions) => {
      writeMetroFiles(metroOptions);
      writeJson(metroOptions.sourceMapPath, value);
    };

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      'sourcemap_invalid',
    );
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it('rejects a missing sourcemap instead of completing a release', () => {
    const runMetro = (metroOptions: MetroOptions) => {
      fs.writeFileSync(metroOptions.bundlePath, bundleBytes);
    };

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      ['sourcemap_invalid', 'metro_failed'],
    );
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it('preserves an indexed Metro sourcemap and its matching Sentry identifiers byte for byte', () => {
    const indexed = {
      ...indexedSourceMap(),
      sections: [
        {offset: {line: 0, column: 0}, map: sourceMap},
        {
          offset: {line: 23, column: 4},
          map: {
            version: 3,
            sources: ['second.js'],
            names: ['second'],
            mappings: 'AAAA',
            sourcesContent: [null],
          },
        },
      ],
    };
    const mapBytes = Buffer.from(
      JSON.stringify(indexed, null, 2) + '\n',
      'utf8',
    );
    const runMetro = (metroOptions: MetroOptions) => {
      fs.writeFileSync(metroOptions.bundlePath, bundleBytes);
      fs.writeFileSync(metroOptions.sourceMapPath, mapBytes);
    };

    const result = prepareUpdate(options, {runMetro, packages: []});

    expect(
      fs.readFileSync(
        path.join(
          result.outputDirectory,
          `debug/${result.packageSha256}.bundle.map`,
        ),
      ),
    ).toEqual(mapBytes);
  });

  it.each([
    ['invalid-nested-map', indexedSourceMap({map: {...sourceMap, version: 2}})],
    ['negative-offset', indexedSourceMap({offset: {line: -1, column: 0}})],
    ['fractional-offset', indexedSourceMap({offset: {line: 0, column: 0.5}})],
    [
      'remote-section',
      indexedSourceMap({url: 'https://other.example/section.map'}),
    ],
  ])('rejects an indexed sourcemap with %s', (_name, value) => {
    const runMetro = (metroOptions: MetroOptions) => {
      writeMetroFiles(metroOptions);
      writeJson(metroOptions.sourceMapPath, value);
    };

    expectFailure(
      () => prepareUpdate(options, {runMetro, packages: []}),
      'sourcemap_invalid',
    );
    expect(fs.existsSync(options.outputDirectory)).toBe(false);
  });

  it.each([
    [32, true],
    [33, false],
  ] as const)(
    'bounds indexed sourcemap nesting at depth %s',
    (depth, accepted) => {
      const runMetro = (metroOptions: MetroOptions) => {
        writeMetroFiles(metroOptions);
        writeJson(metroOptions.sourceMapPath, nestedSourceMap(depth));
      };

      if (accepted) {
        expect(prepareUpdate(options, {runMetro, packages: []})).toHaveProperty(
          'packageSha256',
        );
      } else {
        expectFailure(
          () => prepareUpdate(options, {runMetro, packages: []}),
          'sourcemap_invalid',
        );
        expect(fs.existsSync(options.outputDirectory)).toBe(false);
      }
    },
  );
});

describe('CodePush build arguments', () => {
  const args = [
    '--platform',
    'android',
    '--runtime',
    'runtime.json',
    '--release',
    'release.json',
    '--key',
    'private.pem',
    '--key-id',
    'courier-key-1',
    '--out',
    'output',
  ];

  it('maps every required argument without accepting arbitrary overrides', () => {
    expect(parseArguments(args)).toMatchObject({
      platform: 'android',
      runtimeFile: 'runtime.json',
      releaseFile: 'release.json',
      keyFile: 'private.pem',
      keyId: 'courier-key-1',
      outputDirectory: 'output',
    });
  });

  it('allows signing settings to be supplied by the environment', () => {
    expect(
      parseArguments([
        '--platform',
        'android',
        '--runtime',
        'runtime.json',
        '--release',
        'release.json',
        '--out',
        'output',
      ]),
    ).toEqual({
      platform: 'android',
      runtimeFile: 'runtime.json',
      releaseFile: 'release.json',
      outputDirectory: 'output',
    });
  });

  it.each([
    ['duplicate', [...args, '--platform', 'ios']],
    ['unknown', [...args, '--upload', 'true']],
    ['inherited-object-property', [...args, 'toString', 'unexpected']],
    ['missing-value', args.slice(0, -1)],
    ['missing-option', args.slice(2)],
    ['positional', [...args, 'unexpected']],
  ])('rejects %s arguments', (_name, invalid) => {
    expect(() => parseArguments(invalid)).toThrow();
  });
});
