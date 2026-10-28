const crypto = require('node:crypto');
const fs = require('node:fs');
const {
  CODE_PUSH_LIMITS,
  CODE_PUSH_SIGNATURE_CONTEXT,
} = require('./codepush-contract.cjs');

const NOW_MS = Date.parse('2026-10-23T09:00:00Z');
const KEY_ID = 'download-test-key';
const INSTALL_ID = '0'.repeat(32);
const BUNDLE = Buffer.from(
  'global.__codepushDownloadFixture = true;\n',
  'utf8',
);

function fixtureRuntime(platform) {
  return {
    appId: 'jaco-driver',
    applicationIdentifier:
      platform === 'android'
        ? 'com.jacodrivertest'
        : 'org.reactjs.native.example.jacoDriverTest',
    platform,
    nativeRuntimeId: (platform === 'android' ? 'a' : 'b').repeat(64),
    nativeBuild: platform === 'android' ? '97' : '26',
    rnVersion: '0.88.0',
    hermesVersion: '260318099.0.4',
    bundleFormat: 'js',
    storageContract: {driverOfflineCache: 1, offlineMaps: 1},
  };
}

function packageURL(payload) {
  const extension = payload.platform === 'android' ? 'bundle' : 'jsbundle';
  return `https://storage.yandexcloud.net/jaco-driver-codepush/${payload.platform}/${payload.nativeRuntimeId}/releases/${payload.package.sha256}.${extension}`;
}

function fixturePayload(runtime) {
  const payload = {
    schemaVersion: 1,
    appId: runtime.appId,
    applicationIdentifier: runtime.applicationIdentifier,
    platform: runtime.platform,
    nativeRuntimeId: runtime.nativeRuntimeId,
    minNativeBuild: runtime.nativeBuild,
    maxNativeBuild: runtime.nativeBuild,
    rnVersion: runtime.rnVersion,
    hermesVersion: runtime.hermesVersion,
    bundleFormat: 'js',
    manifestSequence: 1,
    releaseId: 'download-fixture-1',
    version: '1.0.1',
    issuedAt: new Date(NOW_MS - 86400000).toISOString(),
    expiresAt: new Date(NOW_MS + 86400000).toISOString(),
    enabled: true,
    rolloutBasisPoints: 10000,
    rolloutSeed: 'download-fixture-rollout',
    package: {
      format: 'bundle',
      url: '',
      size: BUNDLE.length,
      sha256: crypto.createHash('sha256').update(BUNDLE).digest('hex'),
      entrypoint:
        runtime.platform === 'android'
          ? 'index.android.bundle'
          : 'main.jsbundle',
    },
    storageContract: {driverOfflineCache: 1, offlineMaps: 1},
  };
  payload.package.url = packageURL(payload);
  return payload;
}

function generateVectors() {
  // Artificial fixtures only. The ephemeral private key never leaves this scope.
  // No environment variables, application key files or credentials are read.
  const pair = crypto.generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  const publicSPKI = pair.publicKey
    .export({format: 'der', type: 'spki'})
    .toString('base64');
  const context = Buffer.from(CODE_PUSH_SIGNATURE_CONTEXT, 'utf8');
  const runtimes = {
    android: fixtureRuntime('android'),
    ios: fixtureRuntime('ios'),
  };
  const vectors = [];
  const signedEnvelope = (payloadBytes, prefix = context) => ({
    keyId: KEY_ID,
    payloadBase64: payloadBytes.toString('base64'),
    signatureBase64: crypto
      .sign('sha256', Buffer.concat([prefix, payloadBytes]), {
        key: pair.privateKey,
        dsaEncoding: 'der',
      })
      .toString('base64'),
  });

  for (const platform of ['android', 'ios']) {
    const original = fixturePayload(runtimes[platform]);
    const originalJSON = JSON.stringify(original);
    const originalEnvelope = signedEnvelope(Buffer.from(originalJSON));
    const add = (
      name,
      envelope,
      expectedStatus,
      expectedErrorCodes = [],
      nowMs = NOW_MS,
    ) => {
      const bytes = Buffer.isBuffer(envelope)
        ? envelope
        : Buffer.from(
            typeof envelope === 'string' ? envelope : JSON.stringify(envelope),
            'utf8',
          );
      vectors.push({
        name: `${platform}/${name}`,
        platform,
        envelopeBase64: bytes.toString('base64'),
        nowMs,
        expectedStatus,
        expectedErrorCodes,
      });
    };
    const payloadCase = (
      name,
      mutate,
      expectedErrorCode,
      expectedStatus = 'error',
    ) => {
      const payload = JSON.parse(originalJSON);
      mutate(payload);
      add(
        name,
        signedEnvelope(Buffer.from(JSON.stringify(payload))),
        expectedStatus,
        expectedErrorCode ? [expectedErrorCode] : [],
      );
    };
    const rawPayloadCase = (name, bytes, code) =>
      add(
        name,
        signedEnvelope(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)),
        'error',
        [code],
      );

    add('valid', originalEnvelope, 'downloaded');
    add(
      'valid-exact-payload-whitespace',
      signedEnvelope(Buffer.from(` \n${originalJSON}\r\n`)),
      'downloaded',
    );
    add(
      'valid-escaped-payload-key',
      signedEnvelope(
        Buffer.from(originalJSON.replace('"appId"', '"app\\u0049d"')),
      ),
      'downloaded',
    );
    payloadCase(
      'valid-signed-url-query',
      payload => {
        payload.package.url +=
          '?part=1&part=2&signature=ab%2FCD%2B&empty=&plus=+';
      },
      null,
      'downloaded',
    );
    payloadCase(
      'valid-url-at-length-limit',
      payload => {
        payload.package.url +=
          '?' +
          'a'.repeat(
            CODE_PUSH_LIMITS.urlCharacters - payload.package.url.length - 1,
          );
      },
      null,
      'downloaded',
    );
    payloadCase(
      'valid-maximum-sequence',
      payload => {
        payload.manifestSequence = Number.MAX_SAFE_INTEGER;
      },
      null,
      'downloaded',
    );
    payloadCase(
      'valid-issued-at-current-time',
      payload => {
        payload.issuedAt = new Date(NOW_MS).toISOString();
      },
      null,
      'downloaded',
    );
    payloadCase(
      'disabled',
      payload => {
        payload.enabled = false;
      },
      null,
      'disabled',
    );
    payloadCase(
      'rollout-zero',
      payload => {
        payload.rolloutBasisPoints = 0;
      },
      null,
      'not_selected',
    );
    // For installId 000...000 / jaco-driver / download-fixture-rollout the
    // specified SHA-256 cohort slot is 2795 on both native platforms.
    payloadCase(
      'rollout-boundary-selected',
      payload => {
        payload.rolloutBasisPoints = 2796;
      },
      null,
      'downloaded',
    );
    payloadCase(
      'rollout-boundary-not-selected',
      payload => {
        payload.rolloutBasisPoints = 2795;
      },
      null,
      'not_selected',
    );

    const signature = Buffer.from(originalEnvelope.signatureBase64, 'base64');
    signature[signature.length - 1] ^= 1;
    add(
      'signature-invalid',
      {...originalEnvelope, signatureBase64: signature.toString('base64')},
      'error',
      ['signature_invalid'],
    );
    add(
      'key-unknown',
      {...originalEnvelope, keyId: 'unknown-download-key'},
      'error',
      ['key_unknown'],
    );
    add(
      'payload-changed-after-signing',
      {
        ...originalEnvelope,
        payloadBase64: Buffer.from(originalJSON + ' ').toString('base64'),
      },
      'error',
      ['signature_invalid'],
    );
    add(
      'signature-missing-domain-context',
      signedEnvelope(Buffer.from(originalJSON), Buffer.alloc(0)),
      'error',
      ['signature_invalid'],
    );

    rawPayloadCase(
      'payload-duplicate-key',
      originalJSON.replace('{', '{"schemaVersion":1,'),
      'json_duplicate_key',
    );
    rawPayloadCase(
      'payload-escaped-duplicate-key',
      originalJSON.replace('{', '{"schema\\u0056ersion":1,'),
      'json_duplicate_key',
    );
    for (const [name, token] of [
      ['fractional-number', '1.5'],
      ['exponent-number', '1e0'],
      ['negative-zero', '-0'],
      ['unsafe-integer', '9007199254740992'],
    ])
      rawPayloadCase(
        name,
        originalJSON.replace(
          '"manifestSequence":1',
          `"manifestSequence":${token}`,
        ),
        'json_invalid',
      );
    rawPayloadCase(
      'payload-invalid-utf8',
      Buffer.from([0xff, 0xc0, 0x80]),
      'utf8_invalid',
    );
    payloadCase(
      'payload-extra-field',
      payload => {
        payload.extra = 'unexpected';
      },
      'fields_invalid',
    );
    payloadCase(
      'runtime-mismatch',
      payload => {
        payload.nativeRuntimeId = 'c'.repeat(64);
        payload.package.url = packageURL(payload);
      },
      'runtime_mismatch',
    );
    payloadCase(
      'native-build-mismatch',
      payload => {
        payload.minNativeBuild = payload.maxNativeBuild = '98';
      },
      'runtime_mismatch',
    );
    payloadCase(
      'rn-version-mismatch',
      payload => {
        payload.rnVersion = '0.87.1';
      },
      'runtime_mismatch',
    );
    payloadCase(
      'hermes-version-mismatch',
      payload => {
        payload.hermesVersion = 'other-hermes';
      },
      'runtime_mismatch',
    );
    payloadCase(
      'app-id-mismatch',
      payload => {
        payload.appId = 'jaco-client';
      },
      'app_mismatch',
    );
    payloadCase(
      'application-identifier-mismatch',
      payload => {
        payload.applicationIdentifier = 'com.other.application';
      },
      'runtime_mismatch',
    );
    payloadCase(
      'platform-mismatch',
      payload => {
        payload.platform = platform === 'android' ? 'ios' : 'android';
        payload.package.entrypoint =
          payload.platform === 'android'
            ? 'index.android.bundle'
            : 'main.jsbundle';
        payload.package.url = packageURL(payload);
      },
      'runtime_mismatch',
    );
    payloadCase(
      'storage-contract-unsupported',
      payload => {
        payload.storageContract.offlineMaps = 2;
      },
      'field_invalid',
    );
    payloadCase(
      'expired',
      payload => {
        payload.issuedAt = new Date(NOW_MS - 2 * 86400000).toISOString();
        payload.expiresAt = new Date(NOW_MS - 1).toISOString();
      },
      'manifest_expired',
    );
    payloadCase(
      'not-yet-valid',
      payload => {
        payload.issuedAt = new Date(NOW_MS + 1).toISOString();
      },
      'manifest_not_yet_valid',
    );
    payloadCase(
      'invalid-calendar-date',
      payload => {
        payload.issuedAt = '2026-02-30T09:00:00Z';
      },
      'field_invalid',
    );
    payloadCase(
      'native-build-range-unsupported',
      payload => {
        payload.maxNativeBuild = '99';
      },
      'field_invalid',
    );
    payloadCase(
      'native-build-number-instead-of-string',
      payload => {
        payload.minNativeBuild = payload.maxNativeBuild = 97;
      },
      'field_invalid',
    );
    payloadCase(
      'url-non-ascii',
      payload => {
        payload.package.url += '?image=курьер';
      },
      'url_invalid',
    );
    payloadCase(
      'url-other-host',
      payload => {
        payload.package.url = payload.package.url.replace(
          'storage.yandexcloud.net',
          'other.example',
        );
      },
      'url_source_mismatch',
    );
    payloadCase(
      'url-wrong-path',
      payload => {
        payload.package.url = payload.package.url.replace(
          '/releases/',
          '/other/',
        );
      },
      'url_source_mismatch',
    );
    payloadCase(
      'url-malformed-query',
      payload => {
        payload.package.url += '?token=%xy';
      },
      'url_invalid',
    );
    payloadCase(
      'zip-format-unsupported',
      payload => {
        payload.package.format = 'zip';
      },
      'format_unsupported',
    );
    payloadCase(
      'wrong-entrypoint',
      payload => {
        payload.package.entrypoint = 'other.bundle';
      },
      'package_invalid',
    );
    payloadCase(
      'bundle-size-zero',
      payload => {
        payload.package.size = 0;
      },
      'field_invalid',
    );
    payloadCase(
      'bundle-size-over-limit',
      payload => {
        payload.package.size = CODE_PUSH_LIMITS.packageBytes + 1;
      },
      'field_invalid',
    );
    payloadCase(
      'bundle-hash-malformed',
      payload => {
        payload.package.sha256 = 'A'.repeat(64);
      },
      'field_invalid',
    );
    payloadCase(
      'hermes-bytecode-unsupported',
      payload => {
        payload.bundleFormat = 'hbc';
      },
      'format_unsupported',
    );
    payloadCase(
      'schema-unsupported',
      payload => {
        payload.schemaVersion = 2;
      },
      'schema_unsupported',
    );
    rawPayloadCase(
      'payload-invalid-json',
      originalJSON.slice(0, -1),
      'json_invalid',
    );
    add('envelope-invalid-utf8', Buffer.from([0xff, 0xc0, 0x80]), 'error', [
      'utf8_invalid',
    ]);
    add(
      'envelope-extra-field',
      {...originalEnvelope, extra: 'unexpected'},
      'error',
      ['fields_invalid'],
    );
    add(
      'envelope-duplicate-key',
      JSON.stringify(originalEnvelope).replace('{', `{"keyId":"${KEY_ID}",`),
      'error',
      ['json_duplicate_key'],
    );
    rawPayloadCase(
      'payload-too-deep',
      originalJSON.replace(
        /}$/,
        `,"deep":${'['.repeat(34)}0${']'.repeat(34)}}`,
      ),
      'json_too_deep',
    );
    add(
      'envelope-over-size-limit',
      Buffer.alloc(CODE_PUSH_LIMITS.envelopeBytes + 1, 0x20),
      'error',
      ['input_too_large'],
    );
    add(
      'payload-over-size-limit',
      {
        ...originalEnvelope,
        payloadBase64: Buffer.alloc(
          CODE_PUSH_LIMITS.payloadBytes + 1,
          0x20,
        ).toString('base64'),
      },
      'error',
      ['field_invalid'],
    );
  }

  if (new Set(vectors.map(vector => vector.name)).size !== vectors.length)
    throw new Error('download_vectors_invalid');
  return {
    schemaVersion: 1,
    nowMs: NOW_MS,
    installId: INSTALL_ID,
    trustedKeys: {[KEY_ID]: publicSPKI},
    runtimes,
    bundleBase64: BUNDLE.toString('base64'),
    vectors,
  };
}

function serializeTSV(result) {
  const publicSPKI = result.trustedKeys[KEY_ID];
  return (
    result.vectors
      .map(vector =>
        [
          Buffer.from(vector.name, 'utf8').toString('base64'),
          vector.platform,
          vector.envelopeBase64,
          publicSPKI,
          String(vector.nowMs),
          vector.expectedStatus,
          vector.expectedErrorCodes.length
            ? vector.expectedErrorCodes.join(',')
            : '-',
          result.bundleBase64,
          result.installId,
        ].join('\t'),
      )
      .join('\n') + '\n'
  );
}

module.exports = {generateVectors, serializeTSV};

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (
        !['--out', '--tsv'].includes(args[i]) ||
        !args[i + 1] ||
        args[i + 1].startsWith('--') ||
        options[args[i]]
      )
        throw new Error('arguments_invalid');
      options[args[i]] = args[i + 1];
    }
    if (!options['--out']) throw new Error('arguments_invalid');
    const result = generateVectors();
    fs.writeFileSync(options['--out'], JSON.stringify(result) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    if (options['--tsv'])
      fs.writeFileSync(options['--tsv'], serializeTSV(result), {
        flag: 'wx',
        mode: 0o600,
      });
    console.log(
      `CodePush download vectors: ${result.vectors.length}; ephemeral test public key only.`,
    );
  } catch {
    console.error('CodePush download vectors: preparation_failed');
    process.exitCode = 1;
  }
}
