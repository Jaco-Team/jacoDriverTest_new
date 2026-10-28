import {parseStrictJson} from './json';
import {
  CODE_PUSH_APP_ID,
  CODE_PUSH_BUCKET,
  CODE_PUSH_LIMITS,
  CODE_PUSH_STORAGE_ORIGIN,
  type CodePushValidationCode,
  type FormatCheck,
  type ManifestEnvelopeV1,
  type ManifestIdentity,
  type ManifestPayloadV1,
  type NativeRuntimeContext,
  type StorageContractV1,
  type UpdatePackageV1,
} from './types';

const HASH = /^[a-f0-9]{64}$/;
const BUILD = /^[1-9][0-9]{0,18}$/;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const PAYLOAD_KEYS = [
  'schemaVersion',
  'appId',
  'applicationIdentifier',
  'platform',
  'nativeRuntimeId',
  'minNativeBuild',
  'maxNativeBuild',
  'rnVersion',
  'hermesVersion',
  'bundleFormat',
  'manifestSequence',
  'releaseId',
  'version',
  'issuedAt',
  'expiresAt',
  'enabled',
  'rolloutBasisPoints',
  'rolloutSeed',
  'package',
  'storageContract',
];

class Invalid extends Error {
  constructor(
    readonly code: CodePushValidationCode,
    readonly field: string,
  ) {
    super(code); // Never include remote values, URLs or key material in errors.
  }
}

function requireCondition(
  condition: unknown,
  field: string,
  code: CodePushValidationCode = 'field_invalid',
): asserts condition {
  if (!condition) throw new Invalid(code, field);
}

function record(
  value: unknown,
  keys: readonly string[],
  field: string,
): Record<string, unknown> {
  requireCondition(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    field,
    'fields_invalid',
  );
  const result = value as Record<string, unknown>;
  const actual = Object.keys(result);
  requireCondition(
    actual.length === keys.length &&
      keys.every(key => Object.prototype.hasOwnProperty.call(result, key)),
    field,
    'fields_invalid',
  );
  return result;
}

function text(value: unknown, pattern: RegExp, field: string): string {
  requireCondition(typeof value === 'string' && matches(value, pattern), field);
  return value;
}

function matches(value: string, pattern: RegExp): boolean {
  return pattern.exec(value)?.[0] === value;
}

function integer(
  value: unknown,
  min: number,
  max: number,
  field: string,
): number {
  requireCondition(
    typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= min &&
      value <= max,
    field,
  );
  return value;
}

function hash(value: unknown, field: string): string {
  return text(value, HASH, field);
}

function timestamp(value: unknown, field: string): string {
  const result = text(
    value,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    field,
  );
  const parsed = Date.parse(result);
  requireCondition(Number.isFinite(parsed), field);
  const canonical = result.includes('.')
    ? result
    : result.replace('Z', '.000Z');
  requireCondition(new Date(parsed).toISOString() === canonical, field);
  return result;
}

function storageContract(value: unknown, field: string): StorageContractV1 {
  const contract = record(value, ['driverOfflineCache', 'offlineMaps'], field);
  requireCondition(
    contract.driverOfflineCache === 1 && contract.offlineMaps === 1,
    field,
  );
  return Object.freeze({driverOfflineCache: 1, offlineMaps: 1});
}

function packageData(
  value: unknown,
  platform: 'android' | 'ios',
  runtimeId: string,
): UpdatePackageV1 {
  const data = record(
    value,
    ['format', 'url', 'size', 'sha256', 'entrypoint'],
    'package',
  );
  requireCondition(
    data.format === 'bundle',
    'package.format',
    'format_unsupported',
  );
  const sha256 = hash(data.sha256, 'package.sha256');
  const size = integer(
    data.size,
    1,
    CODE_PUSH_LIMITS.packageBytes,
    'package.size',
  );
  const entrypoint =
    platform === 'android' ? 'index.android.bundle' : 'main.jsbundle';
  requireCondition(
    data.entrypoint === entrypoint,
    'package.entrypoint',
    'package_invalid',
  );
  const url = data.url;
  requireCondition(
    typeof url === 'string' &&
      url.length <= CODE_PUSH_LIMITS.urlCharacters &&
      matches(url, /^[\x21-\x7e]+$/),
    'package.url',
    'url_invalid',
  );
  const extension = platform === 'android' ? 'bundle' : 'jsbundle';
  const expected = `${CODE_PUSH_STORAGE_ORIGIN}/${CODE_PUSH_BUCKET}/${platform}/${runtimeId}/releases/${sha256}.${extension}`;
  requireCondition(
    url === expected || url.startsWith(`${expected}?`),
    'package.url',
    'url_source_mismatch',
  );
  const query = url.slice(expected.length);
  requireCondition(
    query === '' ||
      (matches(query, /^\?[A-Za-z0-9._~!$&'()*+,;=:@/?%+-]*$/) &&
        !/%(?![0-9a-fA-F]{2})/.test(query)),
    'package.url',
    'url_invalid',
  );

  return Object.freeze({
    format: 'bundle',
    url,
    size,
    sha256,
    entrypoint,
  });
}

function validatePayload(value: unknown): ManifestPayloadV1 {
  const data = record(value, PAYLOAD_KEYS, '$');
  requireCondition(
    data.schemaVersion === 1,
    'schemaVersion',
    'schema_unsupported',
  );
  requireCondition(data.appId === CODE_PUSH_APP_ID, 'appId', 'app_mismatch');
  requireCondition(
    data.platform === 'android' || data.platform === 'ios',
    'platform',
  );
  requireCondition(
    data.bundleFormat === 'js',
    'bundleFormat',
    'format_unsupported',
  );
  const minNativeBuild = text(data.minNativeBuild, BUILD, 'minNativeBuild');
  const maxNativeBuild = text(data.maxNativeBuild, BUILD, 'maxNativeBuild');
  // v1 deliberately targets one native build, not an unproven compatibility range.
  requireCondition(minNativeBuild === maxNativeBuild, 'maxNativeBuild');
  const nativeRuntimeId = hash(data.nativeRuntimeId, 'nativeRuntimeId');
  const issuedAt = timestamp(data.issuedAt, 'issuedAt');
  const expiresAt = timestamp(data.expiresAt, 'expiresAt');
  requireCondition(Date.parse(issuedAt) < Date.parse(expiresAt), 'expiresAt');
  requireCondition(typeof data.enabled === 'boolean', 'enabled');
  return Object.freeze({
    schemaVersion: 1,
    appId: CODE_PUSH_APP_ID,
    applicationIdentifier: text(
      data.applicationIdentifier,
      IDENTIFIER,
      'applicationIdentifier',
    ),
    platform: data.platform,
    nativeRuntimeId,
    minNativeBuild,
    maxNativeBuild,
    rnVersion: text(data.rnVersion, TOKEN, 'rnVersion'),
    hermesVersion: text(data.hermesVersion, TOKEN, 'hermesVersion'),
    bundleFormat: 'js',
    manifestSequence: integer(
      data.manifestSequence,
      1,
      Number.MAX_SAFE_INTEGER,
      'manifestSequence',
    ),
    releaseId: text(data.releaseId, TOKEN, 'releaseId'),
    version: text(data.version, TOKEN, 'version'),
    issuedAt,
    expiresAt,
    enabled: data.enabled,
    rolloutBasisPoints: integer(
      data.rolloutBasisPoints,
      0,
      10000,
      'rolloutBasisPoints',
    ),
    rolloutSeed: text(data.rolloutSeed, TOKEN, 'rolloutSeed'),
    package: packageData(data.package, data.platform, nativeRuntimeId),
    storageContract: storageContract(data.storageContract, 'storageContract'),
  });
}

function capture<T>(operation: () => T): FormatCheck<T> {
  try {
    return {ok: true, value: operation()};
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error instanceof Invalid ? error.code : 'field_invalid',
        field: error instanceof Invalid ? error.field : '$',
      },
    };
  }
}

/** Format only. Callers must separately verify the original signed bytes in native. */
export function parseManifestPayload(
  input: string | Uint8Array,
): FormatCheck<ManifestPayloadV1> {
  const parsed = parseStrictJson(input);
  return parsed.ok ? capture(() => validatePayload(parsed.value)) : parsed;
}

function base64(value: unknown, maxBytes: number, field: string): string {
  requireCondition(
    typeof value === 'string' && value.length > 0 && value.length % 4 === 0,
    field,
  );
  requireCondition(matches(value, /^[A-Za-z0-9+/]+={0,2}$/), field);
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const size = (value.length / 4) * 3 - padding;
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  if (padding) {
    const last = alphabet.indexOf(value[value.length - padding - 1]);
    requireCondition((last & (padding === 2 ? 15 : 3)) === 0, field);
  }
  requireCondition(size > 0 && size <= maxBytes, field);
  return value;
}

/** No key lookup, cryptography or trust decision takes place here. */
export function parseManifestEnvelope(
  input: string | Uint8Array,
): FormatCheck<ManifestEnvelopeV1> {
  const parsed = parseStrictJson(input, CODE_PUSH_LIMITS.envelopeBytes);
  return parsed.ok
    ? capture(() => {
        const data = record(
          parsed.value,
          ['keyId', 'payloadBase64', 'signatureBase64'],
          '$',
        );
        return Object.freeze({
          keyId: text(data.keyId, TOKEN, 'keyId'),
          payloadBase64: base64(
            data.payloadBase64,
            CODE_PUSH_LIMITS.payloadBytes,
            'payloadBase64',
          ),
          signatureBase64: base64(data.signatureBase64, 72, 'signatureBase64'),
        });
      })
    : parsed;
}

/** Uses metadata supplied by the installed binary; does not approve activation. */
export function checkManifestCompatibility(
  manifest: ManifestPayloadV1,
  runtime: NativeRuntimeContext,
): FormatCheck<true> {
  return capture(() => {
    requireCondition(
      runtime !== null && typeof runtime === 'object',
      '$runtime',
      'runtime_invalid',
    );
    requireCondition(
      typeof runtime.nativeBuild === 'string' &&
        matches(runtime.nativeBuild, BUILD),
      'nativeBuild',
      'runtime_invalid',
    );
    const expected = record(
      runtime,
      [
        'appId',
        'applicationIdentifier',
        'platform',
        'nativeRuntimeId',
        'nativeBuild',
        'rnVersion',
        'hermesVersion',
        'bundleFormat',
        'storageContract',
      ],
      '$runtime',
    );
    requireCondition(
      expected.appId === CODE_PUSH_APP_ID &&
        (expected.platform === 'android' || expected.platform === 'ios'),
      '$runtime',
      'runtime_invalid',
    );
    requireCondition(
      typeof expected.nativeRuntimeId === 'string' &&
        matches(expected.nativeRuntimeId, HASH),
      'nativeRuntimeId',
      'runtime_invalid',
    );
    storageContract(expected.storageContract, '$runtime.storageContract');
    for (const field of [
      'appId',
      'applicationIdentifier',
      'platform',
      'nativeRuntimeId',
      'rnVersion',
      'hermesVersion',
      'bundleFormat',
    ] as const) {
      requireCondition(
        manifest[field] === runtime[field],
        field,
        'runtime_mismatch',
      );
    }
    requireCondition(
      runtime.nativeBuild === manifest.minNativeBuild &&
        runtime.nativeBuild === manifest.maxNativeBuild,
      'nativeBuild',
      'runtime_mismatch',
    );
    requireCondition(
      manifest.storageContract.driverOfflineCache ===
        runtime.storageContract.driverOfflineCache &&
        manifest.storageContract.offlineMaps ===
          runtime.storageContract.offlineMaps,
      'storageContract',
      'runtime_mismatch',
    );
    return true;
  });
}

export function checkManifestFreshness(
  manifest: ManifestPayloadV1,
  nowMs: number,
): FormatCheck<true> {
  return capture(() => {
    requireCondition(
      Number.isSafeInteger(nowMs) && nowMs >= 0,
      '$clock',
      'clock_invalid',
    );
    requireCondition(
      Date.parse(manifest.issuedAt) <= nowMs,
      'issuedAt',
      'manifest_not_yet_valid',
    );
    requireCondition(
      nowMs < Date.parse(manifest.expiresAt),
      'expiresAt',
      'manifest_expired',
    );
    return true;
  });
}

/** Pure comparison only; does not read or persist the native replay watermark. */
export function checkManifestSequence(
  candidate: ManifestIdentity,
  previous: ManifestIdentity | null,
): FormatCheck<true> {
  return capture(() => {
    const valid = (identity: ManifestIdentity) =>
      identity !== null &&
      typeof identity === 'object' &&
      Number.isSafeInteger(identity.manifestSequence) &&
      identity.manifestSequence > 0 &&
      typeof identity.payloadSha256 === 'string' &&
      matches(identity.payloadSha256, HASH);
    requireCondition(
      valid(candidate) && (previous === null || valid(previous)),
      '$sequence',
      'sequence_invalid',
    );
    if (previous !== null) {
      requireCondition(
        candidate.manifestSequence >= previous.manifestSequence,
        'manifestSequence',
        'manifest_replayed',
      );
      requireCondition(
        candidate.manifestSequence !== previous.manifestSequence ||
          candidate.payloadSha256 === previous.payloadSha256,
        'manifestSequence',
        'manifest_sequence_conflict',
      );
    }
    return true;
  });
}

export function getPackageId(manifest: ManifestPayloadV1): string {
  return `${manifest.nativeRuntimeId}:${manifest.package.sha256}`;
}
