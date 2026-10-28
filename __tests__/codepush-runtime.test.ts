import {spawnSync} from 'node:child_process';
import {generateKeyPairSync} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

jest.mock('node:child_process', () => ({spawnSync: jest.fn()}));

type Platform = 'android' | 'ios';
type TrustedKeys = Record<string, string>;
interface Facts {
  platform: Platform;
  applicationIdentifier: string;
  nativeBuild: string;
  rnVersion: string;
  hermesVersion: string;
  variant: string;
  dependencies: unknown[];
  [key: string]: unknown;
}
interface Descriptor {
  schemaVersion: number;
  runtime: {
    appId: string;
    applicationIdentifier: string;
    platform: Platform;
    nativeRuntimeId: string;
    nativeBuild: string;
    rnVersion: string;
    hermesVersion: string;
    bundleFormat: string;
    storageContract: {driverOfflineCache: number; offlineMaps: number};
  };
  sourceInputsSha256: string;
  buildFacts: Facts;
  trustedKeys: TrustedKeys;
}
interface NativePackage {
  name: string;
  root: string;
}
interface SourceOptions {
  root: string;
  platform: Platform;
  trustedKeys: TrustedKeys;
  packages: NativePackage[];
}
interface RuntimeOptions {
  root: string;
  packages: NativePackage[];
  verifySources?: boolean;
}

const {
  canonical,
  digest,
  generateDescriptor,
  sourceFingerprint,
  validateDescriptor,
  exportedRuntime,
  extractRuntime,
  validateKeys,
}: {
  canonical: (value: unknown) => string;
  digest: (value: string | Buffer) => string;
  generateDescriptor: (options: {
    root: string;
    facts: Facts;
    trustedKeys?: TrustedKeys;
    packages: NativePackage[];
  }) => {descriptor: Descriptor; fileCount: number};
  sourceFingerprint: (options: SourceOptions) => {
    sourceInputsSha256: string;
    fileCount: number;
  };
  validateDescriptor: (
    descriptor: unknown,
    options: RuntimeOptions,
  ) => Descriptor;
  exportedRuntime: (bytes: Buffer, options: RuntimeOptions) => Descriptor;
  extractRuntime: (
    artifact: string,
    out: string,
  ) => {
    schemaVersion: number;
    artifactSha256: string;
    descriptor: Descriptor;
  };
  validateKeys: (keys: unknown) => TrustedKeys;
} = require('../scripts/codepush-runtime.cjs');

const archiveTool = jest.mocked(spawnSync);
const rnVersion = '0.88.0';
const hermesVersion = '260318099.0.4';

function write(root: string, relative: string, contents: string | Buffer) {
  const filename = path.join(root, relative);
  fs.mkdirSync(path.dirname(filename), {recursive: true});
  fs.writeFileSync(filename, contents);
}

function json(root: string, relative: string, value: unknown) {
  write(root, relative, JSON.stringify(value));
}

function publicKey(curve = 'prime256v1') {
  return generateKeyPairSync('ec', {namedCurve: curve})
    .publicKey.export({format: 'der', type: 'spki'})
    .toString('base64');
}

function expectCode(operation: () => unknown, expected: string) {
  let failure: unknown;
  try {
    operation();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(failure).toMatchObject({code: expected, message: expected});
}

function toolOutput(stdout: Buffer | string, status = 0) {
  return {
    pid: 1,
    output: [],
    stdout: typeof stdout === 'string' ? stdout : Buffer.from(stdout),
    stderr: Buffer.alloc(0),
    status,
    signal: null,
  };
}

describe('CodePush native runtime identity', () => {
  let root: string;
  let keys: TrustedKeys;

  beforeAll(() => {
    keys = {'courier-key-1': publicKey()};
  });
  beforeEach(() => {
    root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'jaco-codepush-runtime-test-'),
    );
    json(root, 'node_modules/react-native/package.json', {
      name: 'react-native',
      version: rnVersion,
    });
    write(
      root,
      'node_modules/react-native/sdks/hermes-engine/version.properties',
      `HERMES_VERSION_NAME=${hermesVersion}\n`,
    );
    write(
      root,
      'android/app/build.gradle',
      'android { defaultConfig { minSdk = 26 } }\n',
    );
    write(
      root,
      'android/app/proguard-rules.pro',
      '-keep class com.jaco.CodePush { *; }\n',
    );
    write(
      root,
      'android/app/src/main/java/com/jaco/MainApplication.kt',
      'class MainApplication {}\n',
    );
    write(
      root,
      'ios/jacoDriverTest/AppDelegate.swift',
      'class AppDelegate {}\n',
    );
    write(root, 'ios/Podfile', "platform :ios, '16.0'\n");
    write(root, 'ios/Podfile.lock', 'PODS:\n  - Fixture (1.0)\n');
    write(root, 'ios/Pods/Manifest.lock', 'PODS:\n  - Fixture (1.0)\n');
    json(
      root,
      'ios/jacoDriverTest.xcworkspace/xcshareddata/swiftpm/Package.resolved',
      {pins: [], version: 3},
    );
    write(root, 'src/screens/Home.tsx', "export const title = 'Before';\n");
    write(root, 'src/shared/assets/logo.png', Buffer.from([1, 2, 3]));
    write(root, 'src/shared/assets/Roboto.ttf', Buffer.from([4, 5, 6]));
    write(root, 'patches/example+1.0.0.patch', 'native patch fixture\n');
    write(
      root,
      'src/codePush/types.ts',
      "export const CODE_PUSH_APP_ID = 'jaco-driver';\n",
    );
    archiveTool.mockReset();
  });
  afterEach(() => {
    fs.rmSync(root, {recursive: true, force: true});
  });

  function facts(
    platform: Platform = 'android',
    overrides: Partial<Facts> = {},
  ): Facts {
    return {
      platform,
      applicationIdentifier:
        platform === 'android' ? 'com.jacodrivertest' : 'com.jaco.driver',
      nativeBuild: '9007199254740993',
      rnVersion,
      hermesVersion,
      variant: platform === 'android' ? 'release' : 'Release',
      dependencies: [],
      ...overrides,
    };
  }

  function generate(
    platform: Platform = 'android',
    overrides: Partial<Facts> = {},
    packages: NativePackage[] = [],
  ) {
    return generateDescriptor({
      root,
      facts: facts(platform, overrides),
      trustedKeys: keys,
      packages,
    });
  }

  function exported(descriptor: Descriptor) {
    return Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        artifactSha256: 'd'.repeat(64),
        descriptor,
      }),
    );
  }

  it.each<Platform>(['android', 'ios'])(
    'generates a stable descriptor for the actual %s native inputs',
    platform => {
      const first = generate(platform);
      expect(generate(platform)).toEqual(first);
      expect(first.fileCount).toBeGreaterThan(3);
      expect(first.descriptor.sourceInputsSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(first.descriptor.runtime).toMatchObject({
        appId: 'jaco-driver',
        platform,
        nativeBuild: '9007199254740993',
        rnVersion,
        hermesVersion,
        bundleFormat: 'js',
        storageContract: {driverOfflineCache: 1, offlineMaps: 1},
      });
      expect(first.descriptor.runtime.nativeRuntimeId).toMatch(
        /^[a-f0-9]{64}$/,
      );
      expect(
        validateDescriptor(first.descriptor, {root, packages: []}),
      ).toEqual(first.descriptor);
      expect(
        exportedRuntime(exported(first.descriptor), {root, packages: []}),
      ).toEqual(first.descriptor);
    },
  );

  it('canonicalizes object key order while preserving array order', () => {
    expect(canonical({z: {b: 2, a: 1}, a: ['second', 'first']})).toBe(
      '{"a":["second","first"],"z":{"a":1,"b":2}}',
    );
    expect(digest('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('keeps the identity when the same native inputs move to another checkout path', () => {
    const descriptor = generate().descriptor;
    const otherRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'jaco-codepush-runtime-copy-'),
    );
    try {
      fs.cpSync(root, otherRoot, {recursive: true});
      expect(
        generateDescriptor({
          root: otherRoot,
          facts: facts(),
          trustedKeys: keys,
          packages: [],
        }).descriptor,
      ).toEqual(descriptor);
    } finally {
      fs.rmSync(otherRoot, {recursive: true, force: true});
    }
  });

  it('keeps the runtime identity when only JS screens or generated build outputs change', () => {
    const before = generate().descriptor;
    write(root, 'src/screens/Home.tsx', "export const title = 'After OTA';\n");
    write(
      root,
      'android/app/build/generated/autolinking/Generated.java',
      'generated build output',
    );
    write(
      root,
      'android/.gradle/caches/generated.properties',
      'generated cache',
    );
    write(root, 'android/local.properties', 'sdk.dir=/private/local/path');
    write(root, 'android/app/release.keystore', 'not a compatibility input');
    expect(generate().descriptor).toEqual(before);
    expect(exportedRuntime(exported(before), {root, packages: []})).toEqual(
      before,
    );
  });

  it.each([
    ['native source', 'android/app/src/main/java/com/jaco/MainApplication.kt'],
    ['Gradle settings', 'android/app/build.gradle'],
    ['release shrinker rules', 'android/app/proguard-rules.pro'],
    ['image', 'src/shared/assets/logo.png'],
    ['font', 'src/shared/assets/Roboto.ttf'],
    ['native patch', 'patches/example+1.0.0.patch'],
    ['native runtime contract', 'src/codePush/types.ts'],
  ])(
    'changes the identity and refuses an earlier export after changing a %s',
    (_label, file) => {
      const before = generate().descriptor;
      fs.appendFileSync(path.join(root, file), '\nchanged native input\n');
      const after = generate().descriptor;
      expect(after.sourceInputsSha256).not.toBe(before.sourceInputsSha256);
      expect(after.runtime.nativeRuntimeId).not.toBe(
        before.runtime.nativeRuntimeId,
      );
      expectCode(
        () => validateDescriptor(before, {root, packages: []}),
        'native_inputs_changed',
      );
      expectCode(
        () => exportedRuntime(exported(before), {root, packages: []}),
        'native_inputs_changed',
      );
    },
  );

  it.each([
    ['build number', {nativeBuild: '9007199254740994'}],
    ['application identifier', {applicationIdentifier: 'com.jaco.other'}],
    ['ABI selection', {abis: ['arm64-v8a']}],
    ['native dependency resolution', {dependencies: ['native-library:2.0']}],
    ['build variant', {variant: 'localRelease'}],
  ] as [string, Partial<Facts>][])(
    'changes the identity when the %s changes',
    (_label, override) => {
      const before = generate().descriptor;
      const after = generate('android', override).descriptor;
      expect(after.sourceInputsSha256).toBe(before.sourceInputsSha256);
      expect(after.runtime.nativeRuntimeId).not.toBe(
        before.runtime.nativeRuntimeId,
      );
    },
  );

  it('binds the exact trusted public keyring and tolerates an intentionally empty keyring', () => {
    const before = generate().descriptor;
    const changed = generateDescriptor({
      root,
      facts: facts(),
      trustedKeys: {'courier-key-2': publicKey()},
      packages: [],
    }).descriptor;
    expect(changed.sourceInputsSha256).not.toBe(before.sourceInputsSha256);
    expect(changed.runtime.nativeRuntimeId).not.toBe(
      before.runtime.nativeRuntimeId,
    );
    const empty = generateDescriptor({
      root,
      facts: facts(),
      trustedKeys: {},
      packages: [],
    }).descriptor;
    expect(empty.trustedKeys).toEqual({});
    expect(validateDescriptor(empty, {root, packages: []})).toEqual(empty);
  });

  it.each(['rnVersion', 'hermesVersion'] as const)(
    'refuses facts which disagree with installed %s',
    field => {
      expectCode(
        () => generate('android', {[field]: '0.0.1'}),
        'native_version_mismatch',
      );
    },
  );

  it.each(['0', '01', '1.0', '1e2', '1\n', '90071992547409931234'])(
    'rejects a non-canonical or oversized native build number %j',
    nativeBuild => {
      expectCode(() => generate('android', {nativeBuild}), 'runtime_invalid');
    },
  );

  it.each(['rnVersion', 'hermesVersion'] as const)(
    'refuses an earlier export after the installed %s changes',
    field => {
      const descriptor = generate().descriptor;
      if (field === 'rnVersion') {
        json(root, 'node_modules/react-native/package.json', {
          version: '0.89.0',
        });
      } else {
        write(
          root,
          'node_modules/react-native/sdks/hermes-engine/version.properties',
          'HERMES_VERSION_NAME=changed\n',
        );
      }
      expectCode(
        () => exportedRuntime(exported(descriptor), {root, packages: []}),
        'native_inputs_changed',
      );
    },
  );

  it('includes actual RN native SDK files in the selected native package inputs', () => {
    const packages = [
      {
        name: 'react-native',
        root: path.join(root, 'node_modules/react-native'),
      },
    ];
    write(
      root,
      'node_modules/react-native/ReactCommon/jsi/jsi.h',
      'native SDK v1',
    );
    const before = generate('android', {}, packages).descriptor;
    write(
      root,
      'node_modules/react-native/ReactCommon/jsi/jsi.h',
      'native SDK v2',
    );
    expect(
      generate('android', {}, packages).descriptor.runtime.nativeRuntimeId,
    ).not.toBe(before.runtime.nativeRuntimeId);
    expectCode(
      () => exportedRuntime(exported(before), {root, packages}),
      'native_inputs_changed',
    );
  });

  it('includes native package codegen specifications while excluding ordinary dependency JS', () => {
    const packageRoot = path.join(root, 'node_modules/fixture-native');
    json(root, 'node_modules/fixture-native/package.json', {
      name: 'fixture-native',
      version: '1.0.0',
      codegenConfig: {name: 'FixtureSpec', type: 'modules', jsSrcsDir: 'specs'},
    });
    write(
      root,
      'node_modules/fixture-native/specs/NativeFixture.ts',
      'export interface Spec { before(): void }',
    );
    write(
      root,
      'node_modules/fixture-native/index.js',
      'export const screen = 1;',
    );
    const packages = [{name: 'fixture-native', root: packageRoot}];
    const before = generate('android', {}, packages).descriptor;
    write(
      root,
      'node_modules/fixture-native/index.js',
      'export const screen = 2;',
    );
    expect(generate('android', {}, packages).descriptor).toEqual(before);
    write(
      root,
      'node_modules/fixture-native/specs/NativeFixture.ts',
      'export interface Spec { after(value: string): void }',
    );
    expect(
      generate('android', {}, packages).descriptor.runtime.nativeRuntimeId,
    ).not.toBe(before.runtime.nativeRuntimeId);
  });

  it('binds app Codegen configuration and its JS specifications without binding other screens', () => {
    json(root, 'package.json', {
      name: 'fixture',
      codegenConfig: {name: 'AppSpec', jsSrcsDir: 'specs'},
    });
    write(
      root,
      'specs/NativeFixture.ts',
      'export interface Spec { before(): void }',
    );
    const before = generate().descriptor;
    write(root, 'src/screens/Home.tsx', 'export const title = "new screen";');
    expect(generate().descriptor).toEqual(before);
    write(
      root,
      'specs/NativeFixture.ts',
      'export interface Spec { after(): void }',
    );
    expect(generate().descriptor.runtime.nativeRuntimeId).not.toBe(
      before.runtime.nativeRuntimeId,
    );
    expectCode(
      () => exportedRuntime(exported(before), {root, packages: []}),
      'native_inputs_changed',
    );
  });

  it('rejects app Codegen roots outside the checkout', () => {
    json(root, 'package.json', {codegenConfig: {jsSrcsDir: '../outside'}});
    expectCode(() => generate(), 'native_input_invalid');
  });

  it('binds the actual Codegen compiler JavaScript as a native build input', () => {
    json(root, 'node_modules/@react-native/codegen/package.json', {
      name: '@react-native/codegen',
      version: '0.88.0',
    });
    write(
      root,
      'node_modules/@react-native/codegen/src/generate.js',
      'module.exports = "compiler-before";',
    );
    const packages = [
      {
        name: '@react-native/codegen',
        root: path.join(root, 'node_modules/@react-native/codegen'),
      },
    ];
    const before = generate('android', {}, packages).descriptor;
    write(
      root,
      'node_modules/@react-native/codegen/src/generate.js',
      'module.exports = "compiler-after";',
    );
    expect(
      generate('android', {}, packages).descriptor.runtime.nativeRuntimeId,
    ).not.toBe(before.runtime.nativeRuntimeId);
  });

  it('rejects a codegen specification path outside its native package', () => {
    json(root, 'node_modules/fixture-native/package.json', {
      name: 'fixture-native',
      codegenConfig: {jsSrcsDir: '../outside'},
    });
    expectCode(
      () =>
        generate('android', {}, [
          {
            name: 'fixture-native',
            root: path.join(root, 'node_modules/fixture-native'),
          },
        ]),
      'native_input_invalid',
    );
  });

  it('rejects a symlink among native source inputs', () => {
    fs.symlinkSync(
      path.join(root, 'src/screens/Home.tsx'),
      path.join(root, 'android/app/src/main/linked.kt'),
    );
    expectCode(() => generate(), 'native_input_invalid');
  });

  it('rejects a symlink used as the root native source directory', () => {
    fs.renameSync(
      path.join(root, 'android'),
      path.join(root, 'original-android'),
    );
    fs.symlinkSync(
      path.join(root, 'original-android'),
      path.join(root, 'android'),
      'dir',
    );
    expectCode(() => generate(), 'native_input_invalid');
  });

  it('checks actual installed CocoaPods locks before generating an iOS descriptor', () => {
    write(root, 'ios/Pods/Manifest.lock', 'PODS:\n  - Fixture (2.0)\n');
    expectCode(() => generate('ios'), 'native_lock_mismatch');
  });

  it('includes the resolved SwiftPM package pins and rejects missing pins', () => {
    const before = generate('ios').descriptor;
    const pins =
      'ios/jacoDriverTest.xcworkspace/xcshareddata/swiftpm/Package.resolved';
    json(root, pins, {
      pins: [{identity: 'firebase-ios-sdk', state: {version: '13.0.1'}}],
      version: 3,
    });
    expect(generate('ios').descriptor.runtime.nativeRuntimeId).not.toBe(
      before.runtime.nativeRuntimeId,
    );
    expectCode(
      () => exportedRuntime(exported(before), {root, packages: []}),
      'native_inputs_changed',
    );
    fs.unlinkSync(path.join(root, pins));
    expectCode(() => generate('ios'), 'native_lock_mismatch');
  });

  it.each([
    [
      'runtime build',
      (descriptor: Descriptor) => {
        descriptor.runtime.nativeBuild = '7';
      },
    ],
    [
      'runtime identity',
      (descriptor: Descriptor) => {
        descriptor.runtime.nativeRuntimeId = 'e'.repeat(64);
      },
    ],
    [
      'source digest',
      (descriptor: Descriptor) => {
        descriptor.sourceInputsSha256 = 'e'.repeat(64);
      },
    ],
    [
      'build facts',
      (descriptor: Descriptor) => {
        descriptor.buildFacts.variant = 'debug';
      },
    ],
    [
      'storage contract',
      (descriptor: Descriptor) => {
        descriptor.runtime.storageContract.offlineMaps = 2;
      },
    ],
    [
      'schema version',
      (descriptor: Descriptor) => {
        descriptor.schemaVersion = 2;
      },
    ],
    [
      'trusted keys',
      (descriptor: Descriptor) => {
        descriptor.trustedKeys = {};
      },
    ],
  ] as [string, (descriptor: Descriptor) => void][])(
    'rejects a descriptor with a tampered %s',
    (_label, modify) => {
      const descriptor = generate().descriptor;
      modify(descriptor);
      expectCode(
        () =>
          validateDescriptor(descriptor, {
            root,
            packages: [],
            verifySources: false,
          }),
        'runtime_invalid',
      );
    },
  );

  it('rejects a plain manually supplied runtime context instead of an artifact export', () => {
    const {runtime} = generate().descriptor;
    expectCode(
      () =>
        exportedRuntime(Buffer.from(JSON.stringify(runtime)), {
          root,
          packages: [],
        }),
      'runtime_invalid',
    );
  });

  it('rejects missing, extra or duplicated export fields and malformed artifact hashes', () => {
    const descriptor = generate().descriptor;
    const base = {schemaVersion: 1, artifactSha256: 'a'.repeat(64), descriptor};
    for (const value of [
      {descriptor},
      {...base, extra: true},
      {...base, artifactSha256: 'A'.repeat(64)},
      {...base, schemaVersion: 2},
    ]) {
      expectCode(
        () =>
          exportedRuntime(Buffer.from(JSON.stringify(value)), {
            root,
            packages: [],
          }),
        'runtime_invalid',
      );
    }
    const duplicate = JSON.stringify(base).replace(
      '{',
      '{"\\u0073chemaVersion":1,',
    );
    expectCode(
      () => exportedRuntime(Buffer.from(duplicate), {root, packages: []}),
      'runtime_invalid',
    );
  });

  it('reports the same fingerprint and input count separately from descriptor generation', () => {
    const generated = generate();
    expect(
      sourceFingerprint({
        root,
        platform: 'android',
        trustedKeys: keys,
        packages: [],
      }),
    ).toEqual({
      sourceInputsSha256: generated.descriptor.sourceInputsSha256,
      fileCount: generated.fileCount,
    });
  });

  it('extracts validated APK metadata into a new private export file', () => {
    const descriptor = generate().descriptor;
    const apk = path.join(root, 'fixture.apk');
    const out = path.join(root, 'runtime-export.json');
    fs.writeFileSync(apk, 'APK fixture bytes');
    archiveTool.mockReturnValueOnce(
      toolOutput(Buffer.from(JSON.stringify(descriptor))),
    );
    const result = extractRuntime(apk, out);
    expect(archiveTool).toHaveBeenCalledWith(
      'unzip',
      ['-p', apk, 'assets/codepush-runtime.json'],
      expect.objectContaining({maxBuffer: 512 * 1024}),
    );
    expect(result).toEqual({
      schemaVersion: 1,
      artifactSha256: digest(Buffer.from('APK fixture bytes')),
      descriptor,
    });
    expect(JSON.parse(fs.readFileSync(out, 'utf8'))).toEqual(result);
    expect(fs.statSync(out).mode & 0o777).toBe(0o600);
  });

  it('preserves an existing output instead of overwriting a reviewed runtime export', () => {
    const apk = path.join(root, 'fixture.apk');
    const out = path.join(root, 'runtime-export.json');
    fs.writeFileSync(apk, 'APK fixture bytes');
    fs.writeFileSync(out, 'existing reviewed export');
    archiveTool.mockReturnValueOnce(
      toolOutput(Buffer.from(JSON.stringify(generate().descriptor))),
    );
    expect(() => extractRuntime(apk, out)).toThrow();
    expect(fs.readFileSync(out, 'utf8')).toBe('existing reviewed export');
  });

  it('does not create an export when APK extraction fails', () => {
    const apk = path.join(root, 'corrupt.apk');
    const out = path.join(root, 'runtime-export.json');
    fs.writeFileSync(apk, 'broken APK');
    archiveTool.mockReturnValueOnce(toolOutput(Buffer.alloc(0), 1));
    expectCode(() => extractRuntime(apk, out), 'artifact_invalid');
    expect(fs.existsSync(out)).toBe(false);
  });

  it('refuses an artifact whose extracted runtime descriptor has been modified', () => {
    const descriptor = generate().descriptor;
    descriptor.runtime.nativeBuild = '9';
    const apk = path.join(root, 'fixture.apk');
    const out = path.join(root, 'runtime-export.json');
    fs.writeFileSync(apk, 'APK fixture bytes');
    archiveTool.mockReturnValueOnce(
      toolOutput(Buffer.from(JSON.stringify(descriptor))),
    );
    expectCode(() => extractRuntime(apk, out), 'runtime_invalid');
    expect(fs.existsSync(out)).toBe(false);
  });

  it.each([
    {resources: []},
    {
      resources: [
        'Payload/One.app/codepush-runtime.json',
        'Payload/Two.app/codepush-runtime.json',
      ],
    },
  ])(
    'refuses an IPA without exactly one application runtime resource ($resources)',
    ({resources}) => {
      const ipa = path.join(root, 'fixture.ipa');
      fs.writeFileSync(ipa, 'IPA fixture bytes');
      archiveTool.mockReturnValueOnce(toolOutput(resources.join('\n')));
      expectCode(
        () => extractRuntime(ipa, path.join(root, 'out.json')),
        'artifact_invalid',
      );
    },
  );

  it('extracts the single main application resource from an IPA', () => {
    const ipa = path.join(root, 'fixture.ipa');
    fs.writeFileSync(ipa, 'IPA fixture bytes');
    const descriptor = generate('ios').descriptor;
    archiveTool.mockReturnValueOnce(
      toolOutput(
        'Payload/Couriers.app/codepush-runtime.json\nPayload/Couriers.app/PlugIns/Widget.appex/Info.plist\n',
      ),
    );
    archiveTool.mockReturnValueOnce(
      toolOutput(Buffer.from(JSON.stringify(descriptor))),
    );
    expect(extractRuntime(ipa, path.join(root, 'out.json')).descriptor).toEqual(
      descriptor,
    );
    expect(archiveTool).toHaveBeenLastCalledWith(
      'unzip',
      ['-p', ipa, 'Payload/Couriers.app/codepush-runtime.json'],
      expect.any(Object),
    );
  });
});

describe('CodePush built-in trusted public keys', () => {
  let valid: string;
  beforeAll(() => {
    valid = publicKey();
  });

  it('accepts canonical P-256 SPKI public keys and an empty keyring', () => {
    expect(validateKeys({'courier-key-1': valid})).toEqual({
      'courier-key-1': valid,
    });
    expect(validateKeys({})).toEqual({});
  });

  it.each(['', '../key', 'with spaces', 'key\n', 'x'.repeat(65)])(
    'rejects invalid key identifiers %j',
    keyId => {
      expectCode(() => validateKeys({[keyId]: valid}), 'trusted_keys_invalid');
    },
  );

  it.each([null, [], {key: 1}, {key: null}])(
    'rejects malformed keyring types %j',
    value => {
      expectCode(() => validateKeys(value), 'trusted_keys_invalid');
    },
  );

  it('limits the built-in keyring size', () => {
    const keys = Object.fromEntries(
      Array.from({length: 33}, (_, index) => [`key-${index}`, valid]),
    );
    expectCode(() => validateKeys(keys), 'trusted_keys_invalid');
  });

  it('rejects non-canonical base64, malformed SPKI, and invalid P-256 points', () => {
    const invalidPoint = Buffer.from(valid, 'base64');
    invalidPoint.fill(0, 27);
    for (const encoded of [
      valid + '\n',
      valid.slice(0, -2),
      Buffer.alloc(91).toString('base64'),
      invalidPoint.toString('base64'),
    ]) {
      expectCode(() => validateKeys({key: encoded}), 'trusted_keys_invalid');
    }
  });

  it('rejects EC public keys on a different curve', () => {
    expectCode(
      () => validateKeys({key: publicKey('secp384r1')}),
      'trusted_keys_invalid',
    );
  });

  it('rejects RSA public keys and private keys', () => {
    const rsa = generateKeyPairSync('rsa', {modulusLength: 2048});
    expectCode(
      () =>
        validateKeys({
          key: rsa.publicKey
            .export({format: 'der', type: 'spki'})
            .toString('base64'),
        }),
      'trusted_keys_invalid',
    );
    const ec = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
    expectCode(
      () =>
        validateKeys({
          key: ec.privateKey
            .export({format: 'der', type: 'pkcs8'})
            .toString('base64'),
        }),
      'trusted_keys_invalid',
    );
  });
});
