import {
  CODE_PUSH_LIMITS,
  type CodePushPlatform,
  type FormatCheck,
  type ManifestPayloadV1,
  type NativeRuntimeContext,
} from '@/codePush/types';
import {
  checkManifestCompatibility,
  checkManifestFreshness,
  checkManifestSequence,
  getPackageId,
  parseManifestEnvelope,
  parseManifestPayload,
} from '@/codePush/validation';

const RUNTIME_ID = 'a'.repeat(64);
const PACKAGE_HASH = 'b'.repeat(64);
const PAYLOAD_HASH = 'c'.repeat(64);
const OTHER_HASH = 'd'.repeat(64);
const ISSUED = '2026-10-22T08:00:00Z';
const EXPIRES = '2026-10-23T08:00:00Z';

function fixture(platform: CodePushPlatform = 'android') {
  const entrypoint = platform === 'android' ? 'index.android.bundle' : 'main.jsbundle';
  const extension = platform === 'android' ? 'bundle' : 'jsbundle';
  return {
    schemaVersion: 1,
    appId: 'jaco-driver',
    applicationIdentifier: platform === 'android' ? 'com.jacodrivertest' : 'com.jaco.driver',
    platform,
    nativeRuntimeId: RUNTIME_ID,
    minNativeBuild: '42',
    maxNativeBuild: '42',
    rnVersion: '0.88.0',
    hermesVersion: '260318099.0.4',
    bundleFormat: 'js',
    manifestSequence: 7,
    releaseId: 'courier-7',
    version: '1.0.7',
    issuedAt: ISSUED,
    expiresAt: EXPIRES,
    enabled: true,
    rolloutBasisPoints: 10000,
    rolloutSeed: 'courier-rollout-1',
    package: {
      format: 'bundle',
      url: `https://storage.yandexcloud.net/jaco-driver-codepush/${platform}/${RUNTIME_ID}/releases/${PACKAGE_HASH}.${extension}`,
      size: 123,
      sha256: PACKAGE_HASH,
      entrypoint,
    },
    storageContract: {driverOfflineCache: 1, offlineMaps: 1},
  };
}

function parseFixture(value: unknown = fixture()) {
  return parseManifestPayload(JSON.stringify(value));
}

function valueOf<T>(result: FormatCheck<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Fixture failed: ${result.error.code}/${result.error.field}`);
  return result.value;
}

function runtimeFor(manifest: ManifestPayloadV1): NativeRuntimeContext {
  return {
    appId: manifest.appId,
    applicationIdentifier: manifest.applicationIdentifier,
    platform: manifest.platform,
    nativeRuntimeId: manifest.nativeRuntimeId,
    nativeBuild: manifest.minNativeBuild,
    rnVersion: manifest.rnVersion,
    hermesVersion: manifest.hermesVersion,
    bundleFormat: manifest.bundleFormat,
    storageContract: {driverOfflineCache: 1, offlineMaps: 1},
  };
}

describe('CodePush manifest format', () => {
  it.each<CodePushPlatform>(['android', 'ios'])('accepts the complete %s format without granting trust', platform => {
    const source = fixture(platform);
    const parsed = valueOf(parseManifestPayload(new Uint8Array(Buffer.from(JSON.stringify(source)))));

    expect(parsed).toEqual(source);
    expect(checkManifestCompatibility(parsed, runtimeFor(parsed))).toEqual({ok: true, value: true});
    expect(parsed).not.toHaveProperty('trusted');
    expect(parsed).not.toHaveProperty('signatureVerified');
    expect(parsed).not.toHaveProperty('installable');
  });

  it('preserves the original signed query including order, duplicates and encoding', () => {
    const source = fixture();
    source.package.url += '?X-Amz-Signature=ab%2fCD%2B&part=1&part=2&empty=&path=a/b?c&plus=+';

    expect(valueOf(parseFixture(source)).package.url).toBe(source.package.url);
  });

  it('returns an independently frozen manifest and leaves frozen results unchanged during checks', () => {
    const source = fixture();
    const parsed = valueOf(parseFixture(source));
    const runtime = Object.freeze(runtimeFor(parsed));
    const before = JSON.stringify(parsed);

    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.package)).toBe(true);
    expect(Object.isFrozen(parsed.storageContract)).toBe(true);
    expect(checkManifestCompatibility(parsed, runtime)).toEqual({ok: true, value: true});
    expect(checkManifestFreshness(parsed, Date.parse(ISSUED))).toEqual({ok: true, value: true});
    expect(getPackageId(parsed)).toBe(`${RUNTIME_ID}:${PACKAGE_HASH}`);

    source.package.url = 'https://other.example/mutated.bundle';
    expect(JSON.stringify(parsed)).toBe(before);
  });

  it.each<[string, unknown]>([
    ['appId', 'jaco-client'],
    ['schemaVersion', 2],
    ['platform', 'web'],
    ['bundleFormat', 'hbc'],
    ['nativeRuntimeId', 'A'.repeat(64)],
    ['nativeRuntimeId', 'g'.repeat(64)],
    ['nativeRuntimeId', 'a'.repeat(63)],
    ['enabled', 'true'],
    ['manifestSequence', 0],
    ['manifestSequence', 1.5],
    ['manifestSequence', Number.MAX_SAFE_INTEGER + 1],
    ['rolloutBasisPoints', -1],
    ['rolloutBasisPoints', 10001],
    ['rolloutBasisPoints', 0.5],
    ['rnVersion', ''],
    ['applicationIdentifier', 'com.jaco/driver'],
  ])('rejects an invalid %s value (%s)', (field, invalid) => {
    expect(parseFixture({...fixture(), [field]: invalid})).toMatchObject({ok: false});
  });

  it('enforces strict JSON, UTF-8 and byte limits at the payload entry point', () => {
    const source = JSON.stringify(fixture());
    const duplicate = source.replace('"schemaVersion":1', '"schemaVersion":1,"\\u0073chemaVersion":1');

    expect(parseManifestPayload(duplicate))
      .toMatchObject({ok: false, error: {code: 'json_duplicate_key'}});
    expect(parseManifestPayload(new Uint8Array([0x22, 0xc0, 0xaf, 0x22])))
      .toMatchObject({ok: false, error: {code: 'utf8_invalid'}});
    expect(parseManifestPayload(' '.repeat(CODE_PUSH_LIMITS.payloadBytes) + source))
      .toMatchObject({ok: false, error: {code: 'input_too_large'}});
  });

  it.each(['9007199254740991.1', '1e0', '9007199254740993'])
  ('rejects a sequence source token that JSON.parse could round or normalize: %s', literal => {
    const source = JSON.stringify(fixture()).replace('"manifestSequence":7', `"manifestSequence":${literal}`);
    expect(parseManifestPayload(source)).toMatchObject({ok: false, error: {code: 'json_invalid'}});
  });

  it.each(['0', '01', '+42', '42.0', '4e1', ' 42', '42 ', '1'.repeat(20), 42])
  ('rejects noncanonical native build values: %s', build => {
    expect(parseFixture({...fixture(), minNativeBuild: build, maxNativeBuild: build})).toMatchObject({ok: false});
  });

  it('accepts a 19-digit build without lossy number conversion and requires exact matching', () => {
    const parsed = valueOf(parseFixture({
      ...fixture(),
      minNativeBuild: '9999999999999999999',
      maxNativeBuild: '9999999999999999999',
    }));
    const runtime = runtimeFor(parsed);

    expect(checkManifestCompatibility(parsed, runtime)).toEqual({ok: true, value: true});
    expect(checkManifestCompatibility(parsed, {...runtime, nativeBuild: '9999999999999999998'}))
      .toMatchObject({ok: false, error: {code: 'runtime_mismatch', field: 'nativeBuild'}});
    expect(parseFixture({...fixture(), maxNativeBuild: '43'})).toMatchObject({ok: false});
  });

  it.each(['top-level', 'package', 'storage'])('rejects unknown %s fields', level => {
    const source = fixture();
    const changed = level === 'top-level' ? {...source, signatureVerified: true}
      : level === 'package' ? {...source, package: {...source.package, compression: 'zip'}}
        : {...source, storageContract: {...source.storageContract, futureSchema: 2}};

    expect(parseFixture(changed)).toMatchObject({ok: false, error: {code: 'fields_invalid'}});
  });

  it('requires all fields and an object at the manifest root', () => {
    const incomplete: Partial<ReturnType<typeof fixture>> = fixture();
    delete incomplete.expiresAt;
    for (const source of [incomplete, null, [], 1, 'manifest']) {
      expect(parseFixture(source)).toMatchObject({ok: false, error: {code: 'fields_invalid'}});
    }
  });

  it.each([
    {driverOfflineCache: 2, offlineMaps: 1},
    {driverOfflineCache: 1, offlineMaps: 2},
  ])('rejects an incompatible stored-data schema in the payload: %j', storageContract => {
    expect(parseFixture({...fixture(), storageContract})).toMatchObject({ok: false});
  });

  it.each([
    {format: 'zip'},
    {format: 'raw'},
    {format: 'hbc'},
    {size: 0},
    {size: -1},
    {size: 1.5},
    {size: '123'},
    {size: CODE_PUSH_LIMITS.packageBytes + 1},
    {size: Number.MAX_SAFE_INTEGER + 1},
    {sha256: PACKAGE_HASH.toUpperCase()},
    {sha256: 'not-a-hash'},
    {sha256: 'b'.repeat(63)},
    {entrypoint: 'main.jsbundle'},
  ])('rejects an unsupported or inconsistent bundle: %j', invalid => {
    const source = fixture();
    expect(parseFixture({...source, package: {...source.package, ...invalid}})).toMatchObject({ok: false});
  });

  it.each<CodePushPlatform>(['android', 'ios'])('accepts the bundle byte limits for %s', platform => {
    const source = fixture(platform);
    for (const size of [1, CODE_PUSH_LIMITS.packageBytes]) {
      expect(valueOf(parseFixture({...source, package: {...source.package, size}})).package.size).toBe(size);
    }
  });

  it.each(['format', 'url', 'size', 'sha256', 'entrypoint'] as const)
  ('rejects a bundle without %s rather than supplying a default', field => {
    const source = fixture();
    const incomplete: Partial<typeof source.package> = {...source.package};
    delete incomplete[field];

    expect(parseFixture({...source, package: incomplete}))
      .toMatchObject({ok: false, error: {code: 'fields_invalid', field: 'package'}});
  });

  it.each([null, [], 'bundle', 123])('rejects a non-object bundle description: %j', invalid => {
    expect(parseFixture({...fixture(), package: invalid}))
      .toMatchObject({ok: false, error: {code: 'fields_invalid', field: 'package'}});
  });

  it.each([
    {files: []},
    {unpackedSize: 123},
    {assets: ['assets/logo.png']},
    {format: 'zip', unpackedSize: 20, files: [{path: 'index.android.bundle', size: 20, sha256: PAYLOAD_HASH}]},
  ])('rejects archive/resource metadata instead of silently ignoring it: %j', obsolete => {
    const source = fixture();
    expect(parseFixture({...source, package: {...source.package, ...obsolete}}))
      .toMatchObject({ok: false, error: {code: 'fields_invalid', field: 'package'}});
  });

  it.each<CodePushPlatform>(['android', 'ios'])('requires the exact %s local bundle name', platform => {
    const source = fixture(platform);
    const otherEntrypoint = platform === 'android' ? 'main.jsbundle' : 'index.android.bundle';
    for (const entrypoint of [otherEntrypoint, '../' + source.package.entrypoint,
      '/' + source.package.entrypoint, 'assets/' + source.package.entrypoint,
      source.package.entrypoint + '.zip', source.package.entrypoint + '\n',
      'main.hbc', '', null]) {
      expect(parseFixture({...source, package: {...source.package, entrypoint}}))
        .toMatchObject({ok: false, error: {code: 'package_invalid', field: 'package.entrypoint'}});
    }
  });

  it.each<CodePushPlatform>(['android', 'ios'])('rejects ZIP and the other platform extension in the %s URL', platform => {
    const source = fixture(platform);
    const otherExtension = platform === 'android' ? 'jsbundle' : 'bundle';
    const prefix = source.package.url.slice(0, source.package.url.lastIndexOf('.'));
    for (const extension of ['zip', otherExtension, 'hbc', 'png', 'bundle/extra']) {
      expect(parseFixture({...source, package: {...source.package, url: prefix + '.' + extension}}))
        .toMatchObject({ok: false, error: {code: 'url_source_mismatch', field: 'package.url'}});
    }
  });

  it.each([
    (url: string) => url.replace('https:', 'http:'),
    (url: string) => url.replace('storage.yandexcloud.net', 'storage.yandexcloud.net.evil.example'),
    (url: string) => url.replace('storage.yandexcloud.net', 'attacker@storage.yandexcloud.net'),
    (url: string) => url.replace('jaco-driver-codepush/', 'jaco-client-codepush/'),
    (url: string) => url.replace('/android/', '/ios/'),
    (url: string) => url.replace(RUNTIME_ID, OTHER_HASH),
    (url: string) => url.replace(PACKAGE_HASH, PAYLOAD_HASH),
    (url: string) => url.replace('/releases/', '/other/../releases/'),
    (url: string) => url + '#fragment',
    (url: string) => url + '?signature=%zz',
    (url: string) => url + '?signature=with space',
  ])('rejects URLs outside the exact source/path contract or malformed raw query', change => {
    const source = fixture();
    source.package.url = change(source.package.url);

    expect(parseFixture(source)).toMatchObject({ok: false});
  });

  it('reports source errors without reflecting secret query parameters', () => {
    const source = fixture();
    const secret = 'private-signed-query-value';
    source.package.url = `https://other.example/index.android.bundle?token=${secret}`;
    const result = parseFixture(source);

    expect(result).toEqual({ok: false, error: {code: 'url_source_mismatch', field: 'package.url'}});
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it.each([
    {issuedAt: '2026-02-30T08:00:00Z'},
    {issuedAt: '2026-10-22T08:00:00+00:00'},
    {expiresAt: ISSUED},
    {expiresAt: '2026-10-21T08:00:00Z'},
  ])('rejects invalid or reversed publication timestamps: %j', dates => {
    expect(parseFixture({...fixture(), ...dates})).toMatchObject({ok: false});
  });

  it('allows publication exactly at issuedAt and rejects at expiresAt or before issue', () => {
    const parsed = valueOf(parseFixture());

    expect(checkManifestFreshness(parsed, Date.parse(ISSUED))).toEqual({ok: true, value: true});
    expect(checkManifestFreshness(parsed, Date.parse(EXPIRES) - 1)).toEqual({ok: true, value: true});
    expect(checkManifestFreshness(parsed, Date.parse(ISSUED) - 1))
      .toMatchObject({ok: false, error: {code: 'manifest_not_yet_valid'}});
    expect(checkManifestFreshness(parsed, Date.parse(EXPIRES)))
      .toMatchObject({ok: false, error: {code: 'manifest_expired'}});
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects an invalid clock: %s', now => {
    expect(checkManifestFreshness(valueOf(parseFixture()), now))
      .toMatchObject({ok: false, error: {code: 'clock_invalid'}});
  });
});

describe('CodePush installed runtime compatibility', () => {
  it.each<[keyof NativeRuntimeContext, string]>([
    ['applicationIdentifier', 'com.other.app'],
    ['platform', 'ios'],
    ['nativeRuntimeId', OTHER_HASH],
    ['nativeBuild', '41'],
    ['nativeBuild', '43'],
    ['rnVersion', '0.87.1'],
    ['hermesVersion', 'different-hermes'],
    ['bundleFormat', 'hbc'],
  ])('rejects a different %s even when the other RN metadata matches', (field, value) => {
    const parsed = valueOf(parseFixture());
    const runtime = {...runtimeFor(parsed), [field]: value} as NativeRuntimeContext;

    expect(checkManifestCompatibility(parsed, runtime))
      .toMatchObject({ok: false, error: {code: 'runtime_mismatch', field}});
  });

  it.each([
    {appId: 'jaco-client'},
    {nativeBuild: '042'},
    {nativeBuild: 42},
    {nativeRuntimeId: 'a'.repeat(63)},
    {storageContract: {driverOfflineCache: 2, offlineMaps: 1}},
    {unexpected: true},
  ])('rejects malformed installed metadata rather than falling back to remote values: %j', change => {
    const parsed = valueOf(parseFixture());
    const runtime = {...runtimeFor(parsed), ...change} as unknown as NativeRuntimeContext;

    expect(checkManifestCompatibility(parsed, runtime)).toMatchObject({ok: false});
  });

  it('identifies package contents by runtime and bundle hash, not display version', () => {
    const first = valueOf(parseFixture());
    const renamed = valueOf(parseFixture({...fixture(), version: '2.0.0', releaseId: 'renamed'}));

    expect(getPackageId(first)).toBe(getPackageId(renamed));
    expect(getPackageId(first)).toBe(`${RUNTIME_ID}:${PACKAGE_HASH}`);
  });
});

describe('CodePush envelope format without signature verification', () => {
  function envelope() {
    return {
      keyId: 'fixture-key-never-trusted',
      payloadBase64: Buffer.from(JSON.stringify(fixture()), 'utf8').toString('base64'),
      // Arbitrary fixture bytes deliberately are not a valid ECDSA signature.
      signatureBase64: Buffer.from([0]).toString('base64'),
    };
  }

  it('accepts only envelope syntax and does not claim to verify an arbitrary signature or key', () => {
    const source = envelope();
    const parsed = valueOf(parseManifestEnvelope(JSON.stringify(source)));

    expect(parsed).toEqual(source);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(parsed).not.toHaveProperty('trusted');
    expect(parsed).not.toHaveProperty('signatureVerified');
  });

  it.each(['AA', 'AA=', 'AB==', 'AAB=', 'AA==\n', 'AA-_', '', '!!!!'])
  ('rejects malformed or noncanonical base64: %s', encoded => {
    for (const field of ['payloadBase64', 'signatureBase64']) {
      expect(parseManifestEnvelope(JSON.stringify({...envelope(), [field]: encoded}))).toMatchObject({ok: false});
    }
  });

  it('rejects excess decoded payload/signature sizes and envelope byte size', () => {
    const source = envelope();
    expect(parseManifestEnvelope(JSON.stringify({
      ...source,
      payloadBase64: Buffer.alloc(CODE_PUSH_LIMITS.payloadBytes + 1, 0x61).toString('base64'),
    }))).toMatchObject({ok: false});
    expect(parseManifestEnvelope(JSON.stringify({
      ...source,
      signatureBase64: Buffer.alloc(73, 0).toString('base64'),
    }))).toMatchObject({ok: false});
    expect(parseManifestEnvelope(' '.repeat(CODE_PUSH_LIMITS.envelopeBytes) + '{}'))
      .toMatchObject({ok: false, error: {code: 'input_too_large'}});
  });

  it('rejects unknown fields and duplicate escaped envelope keys', () => {
    expect(parseManifestEnvelope(JSON.stringify({...envelope(), algorithm: 'none'})))
      .toMatchObject({ok: false, error: {code: 'fields_invalid'}});
    expect(parseManifestEnvelope('{"keyId":"first","\\u006beyId":"second","payloadBase64":"AA==","signatureBase64":"AA=="}'))
      .toMatchObject({ok: false, error: {code: 'json_duplicate_key'}});
  });
});

describe('CodePush manifest replay comparison', () => {
  const previous = Object.freeze({manifestSequence: 7, payloadSha256: PAYLOAD_HASH});

  it('accepts the first identity, exact replay and a higher sequence without modifying the watermark', () => {
    const before = {...previous};

    expect(checkManifestSequence(previous, null)).toEqual({ok: true, value: true});
    expect(checkManifestSequence(previous, previous)).toEqual({ok: true, value: true});
    expect(checkManifestSequence({manifestSequence: 8, payloadSha256: OTHER_HASH}, previous))
      .toEqual({ok: true, value: true});
    expect(previous).toEqual(before);
  });

  it('rejects older manifests and a different payload at the same sequence', () => {
    expect(checkManifestSequence({manifestSequence: 6, payloadSha256: PAYLOAD_HASH}, previous))
      .toMatchObject({ok: false, error: {code: 'manifest_replayed'}});
    expect(checkManifestSequence({manifestSequence: 7, payloadSha256: OTHER_HASH}, previous))
      .toMatchObject({ok: false, error: {code: 'manifest_sequence_conflict'}});
  });

  it.each([
    {manifestSequence: 0, payloadSha256: PAYLOAD_HASH},
    {manifestSequence: 1.5, payloadSha256: PAYLOAD_HASH},
    {manifestSequence: Number.MAX_SAFE_INTEGER + 1, payloadSha256: PAYLOAD_HASH},
    {manifestSequence: 7, payloadSha256: 'not-a-hash'},
  ])('rejects invalid candidate and stored identities: %j', invalid => {
    expect(checkManifestSequence(invalid, previous))
      .toMatchObject({ok: false, error: {code: 'sequence_invalid'}});
    expect(checkManifestSequence(previous, invalid))
      .toMatchObject({ok: false, error: {code: 'sequence_invalid'}});
  });
});
