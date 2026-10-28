import {spawnSync} from 'node:child_process';
import {createHash, createPublicKey, verify} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CODE_PUSH_LIMITS,
  CODE_PUSH_SIGNATURE_CONTEXT,
  type CodePushPlatform,
  type NativeRuntimeContext,
} from '@/codePush/types';
import {
  checkManifestCompatibility,
  checkManifestFreshness,
  parseManifestEnvelope,
  parseManifestPayload,
} from '@/codePush/validation';

type Status = 'downloaded' | 'disabled' | 'not_selected' | 'error';
interface Vector {
  name: string;
  platform: CodePushPlatform;
  envelopeBase64: string;
  nowMs: number;
  expectedStatus: Status;
  expectedErrorCodes: string[];
}
interface FixtureSet {
  schemaVersion: number;
  nowMs: number;
  installId: string;
  trustedKeys: Record<string, string>;
  runtimes: Record<CodePushPlatform, NativeRuntimeContext>;
  bundleBase64: string;
  vectors: Vector[];
}
const {
  generateVectors,
  serializeTSV,
}: {
  generateVectors: () => FixtureSet;
  serializeTSV: (value: FixtureSet) => string;
} = require('../scripts/codepush-download-vectors.cjs');

const fixtures = generateVectors();
const signatureContext = Buffer.from(CODE_PUSH_SIGNATURE_CONTEXT, 'utf8');

function readAuthenticatedPayload(vector: Vector) {
  const envelope = parseManifestEnvelope(
    Buffer.from(vector.envelopeBase64, 'base64'),
  );
  if (!envelope.ok) throw new Error(envelope.error.code);
  const publicDER = fixtures.trustedKeys[envelope.value.keyId];
  if (!publicDER) throw new Error('key_unknown');
  const publicKey = createPublicKey({
    key: Buffer.from(publicDER, 'base64'),
    format: 'der',
    type: 'spki',
  });
  const payload = Buffer.from(envelope.value.payloadBase64, 'base64');
  if (
    !verify(
      'sha256',
      Buffer.concat([signatureContext, payload]),
      publicKey,
      Buffer.from(envelope.value.signatureBase64, 'base64'),
    )
  )
    throw new Error('signature_invalid');
  return payload;
}

function classify(vector: Vector): {status: Status; error?: string} {
  let bytes: Buffer;
  try {
    bytes = readAuthenticatedPayload(vector);
  } catch (error) {
    return {status: 'error', error: (error as Error).message};
  }
  const manifest = parseManifestPayload(bytes);
  if (!manifest.ok) return {status: 'error', error: manifest.error.code};
  const compatible = checkManifestCompatibility(
    manifest.value,
    fixtures.runtimes[vector.platform],
  );
  if (!compatible.ok) return {status: 'error', error: compatible.error.code};
  const fresh = checkManifestFreshness(manifest.value, vector.nowMs);
  if (!fresh.ok) return {status: 'error', error: fresh.error.code};
  if (!manifest.value.enabled) return {status: 'disabled'};
  const slot =
    createHash('sha256')
      .update(
        `jaco-driver-codepush-rollout-v1\n${fixtures.installId}\n${manifest.value.appId}\n${manifest.value.rolloutSeed}`,
      )
      .digest()
      .readUInt32BE(0) % 10000;
  return {
    status:
      slot < manifest.value.rolloutBasisPoints ? 'downloaded' : 'not_selected',
  };
}

it.each(fixtures.vectors)(
  '$name agrees with the TypeScript contract and independent crypto',
  vector => {
    const result = classify(vector);
    expect(result.status).toBe(vector.expectedStatus);
    if (result.status === 'error') {
      expect(vector.expectedErrorCodes).toContain(result.error);
    } else {
      expect(vector.expectedErrorCodes).toEqual([]);
      expect(result.error).toBeUndefined();
    }
  },
);

it('covers both fixed native runtimes equally without reading real application configuration', () => {
  expect(fixtures.schemaVersion).toBe(1);
  expect(fixtures.nowMs).toBe(Date.parse('2026-10-23T09:00:00Z'));
  expect(fixtures.installId).toBe('0'.repeat(32));
  expect(fixtures.runtimes.android).toEqual({
    appId: 'jaco-driver',
    applicationIdentifier: 'com.jacodrivertest',
    platform: 'android',
    nativeRuntimeId: 'a'.repeat(64),
    nativeBuild: '97',
    rnVersion: '0.88.0',
    hermesVersion: '260318099.0.4',
    bundleFormat: 'js',
    storageContract: {driverOfflineCache: 1, offlineMaps: 1},
  });
  expect(fixtures.runtimes.ios).toEqual({
    ...fixtures.runtimes.android,
    applicationIdentifier: 'org.reactjs.native.example.jacoDriverTest',
    platform: 'ios',
    nativeRuntimeId: 'b'.repeat(64),
    nativeBuild: '26',
  });
  const names = (platform: CodePushPlatform) =>
    fixtures.vectors
      .filter(vector => vector.platform === platform)
      .map(vector => vector.name.slice(platform.length + 1));
  expect(names('android')).toEqual(names('ios'));
  expect(new Set(fixtures.vectors.map(vector => vector.name)).size).toBe(
    fixtures.vectors.length,
  );
  expect(names('android').length).toBeGreaterThanOrEqual(50);
});

it('all successful downloads use exactly the shared body bytes, hash and supported entrypoint', () => {
  const bundle = Buffer.from(fixtures.bundleBase64, 'base64');
  expect(bundle.toString('utf8')).toBe(
    'global.__codepushDownloadFixture = true;\n',
  );
  for (const vector of fixtures.vectors.filter(
    item => item.expectedStatus === 'downloaded',
  )) {
    const manifest = parseManifestPayload(readAuthenticatedPayload(vector));
    if (!manifest.ok) throw new Error(manifest.error.code);
    expect(manifest.value.package.size).toBe(bundle.length);
    expect(manifest.value.package.sha256).toBe(
      createHash('sha256').update(bundle).digest('hex'),
    );
    expect(manifest.value.package.entrypoint).toBe(
      vector.platform === 'android' ? 'index.android.bundle' : 'main.jsbundle',
    );
  }
});

it('authenticates the exact payload bytes and rejects normalization or later modification', () => {
  for (const platform of ['android', 'ios'] as const) {
    const vector = fixtures.vectors.find(
      item => item.name === `${platform}/valid-exact-payload-whitespace`,
    )!;
    const bytes = readAuthenticatedPayload(vector);
    const envelope = JSON.parse(
      Buffer.from(vector.envelopeBase64, 'base64').toString('utf8'),
    );
    const key = createPublicKey({
      key: Buffer.from(fixtures.trustedKeys[envelope.keyId], 'base64'),
      format: 'der',
      type: 'spki',
    });
    const normalized = Buffer.from(
      JSON.stringify(JSON.parse(bytes.toString('utf8'))),
    );
    expect(bytes.equals(normalized)).toBe(false);
    expect(
      verify(
        'sha256',
        Buffer.concat([signatureContext, normalized]),
        key,
        Buffer.from(envelope.signatureBase64, 'base64'),
      ),
    ).toBe(false);
    expect(
      verify(
        'sha256',
        Buffer.concat([signatureContext, bytes, Buffer.from(' ')]),
        key,
        Buffer.from(envelope.signatureBase64, 'base64'),
      ),
    ).toBe(false);
  }
});

it('includes byte and URL boundary fixtures without requiring oversized successful transfers', () => {
  for (const platform of ['android', 'ios'] as const) {
    const atURLLimit = fixtures.vectors.find(
      item => item.name === `${platform}/valid-url-at-length-limit`,
    )!;
    const payload = parseManifestPayload(readAuthenticatedPayload(atURLLimit));
    if (!payload.ok) throw new Error(payload.error.code);
    expect(payload.value.package.url.length).toBe(
      CODE_PUSH_LIMITS.urlCharacters,
    );
    const envelopeLimit = fixtures.vectors.find(
      item => item.name === `${platform}/envelope-over-size-limit`,
    )!;
    expect(Buffer.from(envelopeLimit.envelopeBase64, 'base64').length).toBe(
      CODE_PUSH_LIMITS.envelopeBytes + 1,
    );
  }
});

it('exports only ephemeral public keys and produces a different test key on a new run', () => {
  const encoded = JSON.stringify(fixtures);
  expect(encoded).not.toContain('PRIVATE KEY');
  expect(encoded).not.toContain('privateKey');
  expect(Object.keys(fixtures.trustedKeys)).toEqual(['download-test-key']);
  const key = createPublicKey({
    key: Buffer.from(fixtures.trustedKeys['download-test-key'], 'base64'),
    format: 'der',
    type: 'spki',
  });
  expect(key.asymmetricKeyType).toBe('ec');
  expect(key.asymmetricKeyDetails?.namedCurve).toBe('prime256v1');
  expect(generateVectors().trustedKeys).not.toEqual(fixtures.trustedKeys);
});

it('serializes every fixture to the shared nine-column native harness format', () => {
  const rows = serializeTSV(fixtures).trimEnd().split('\n');
  expect(rows).toHaveLength(fixtures.vectors.length);
  for (const [index, row] of rows.entries()) {
    const vector = fixtures.vectors[index];
    const cells = row.split('\t');
    expect(cells).toHaveLength(9);
    expect(Buffer.from(cells[0], 'base64').toString('utf8')).toBe(vector.name);
    expect(cells.slice(1)).toEqual([
      vector.platform,
      vector.envelopeBase64,
      fixtures.trustedKeys['download-test-key'],
      String(vector.nowMs),
      vector.expectedStatus,
      vector.expectedErrorCodes.join(',') || '-',
      fixtures.bundleBase64,
      fixtures.installId,
    ]);
  }
});

it('writes JSON and TSV through the CLI and refuses to overwrite existing files', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'jaco-download-vectors-'),
  );
  try {
    const json = path.join(directory, 'vectors.json');
    const tsv = path.join(directory, 'vectors.tsv');
    const script = path.resolve(
      __dirname,
      '../scripts/codepush-download-vectors.cjs',
    );
    const args = [script, '--out', json, '--tsv', tsv];
    const first = spawnSync(process.execPath, args, {encoding: 'utf8'});
    expect(first.status).toBe(0);
    const result: FixtureSet = JSON.parse(fs.readFileSync(json, 'utf8'));
    expect(result.vectors).toHaveLength(fixtures.vectors.length);
    expect(fs.readFileSync(tsv, 'utf8')).toBe(serializeTSV(result));
    expect(fs.statSync(json).mode & 0o777).toBe(0o600);
    expect(fs.statSync(tsv).mode & 0o777).toBe(0o600);
    const second = spawnSync(process.execPath, args, {encoding: 'utf8'});
    expect(second.status).toBe(1);
    expect(JSON.parse(fs.readFileSync(json, 'utf8'))).toEqual(result);
    expect(second.stderr).not.toContain('PRIVATE KEY');
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});
