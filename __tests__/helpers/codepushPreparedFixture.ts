import fs from 'node:fs';
import path from 'node:path';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';

const {generateDescriptor}: {
  generateDescriptor: (options: Record<string, unknown>) => {descriptor: {
    runtime: Record<string, string>; buildFacts: Record<string, unknown>; trustedKeys: Record<string, string>;
  }};
} = require('../../scripts/codepush-runtime.cjs');

export function makePreparedFixture(directory: string, {
  platform = 'android', sequence = 7,
}: {platform?: 'android' | 'ios'; sequence?: number} = {}) {
  const root = path.join(directory, 'project');
  const files: Record<string, string> = {
    'package.json': '{}',
    'node_modules/react-native/package.json': JSON.stringify({version: '0.88.0'}),
    'node_modules/react-native/sdks/hermes-engine/version.properties': 'HERMES_VERSION_NAME=260318099.0.4\n',
    'index.js': 'global.fixture = true;', 'metro.config.js': 'module.exports = {};',
    'ios/Podfile.lock': 'PODS:\n  - hermes-engine (260318099.0.4)\n',
    'ios/Pods/Manifest.lock': 'PODS:\n  - hermes-engine (260318099.0.4)\n',
    'ios/jacoDriverTest.xcworkspace/xcshareddata/swiftpm/Package.resolved': JSON.stringify({pins: []}),
  };
  for (const [file, bytes] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), {recursive: true});
    fs.writeFileSync(path.join(root, file), bytes);
  }
  const key = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  const keyId = 'test-key';
  const keyFile = path.join(directory, 'private.pem');
  fs.writeFileSync(keyFile, key.privateKey.export({type: 'pkcs8', format: 'pem'}), {mode: 0o600});
  const {descriptor} = generateDescriptor({root, packages: [], facts: {
    platform, applicationIdentifier: platform === 'android' ?
      'com.jacodrivertest' : 'org.reactjs.native.example.jacoDriverTest',
    nativeBuild: '97', rnVersion: '0.88.0', hermesVersion: '260318099.0.4',
    variant: 'Release',
  }, trustedKeys: {[keyId]: key.publicKey.export({type: 'spki', format: 'der'}).toString('base64')}});
  const prepared = path.join(directory, 'prepared');
  const bundle = Buffer.from('global.__fixtureLabel = "healthy";\n');
  const hash = createHash('sha256').update(bundle).digest('hex');
  const prefix = `${platform}/${descriptor.runtime.nativeRuntimeId}`;
  const bundleKey = `${prefix}/releases/${hash}.${platform === 'android' ? 'bundle' : 'jsbundle'}`;
  const release = {manifestSequence: sequence, releaseId: `release-${sequence}`, version: `1.${sequence}`,
    issuedAt: '2026-10-01T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z',
    enabled: true, rolloutBasisPoints: 10000, rolloutSeed: 'test-release'};
  const payload = {schemaVersion: 1, appId: 'jaco-driver', applicationIdentifier: descriptor.runtime.applicationIdentifier,
    platform, nativeRuntimeId: descriptor.runtime.nativeRuntimeId, minNativeBuild: '97', maxNativeBuild: '97',
    rnVersion: '0.88.0', hermesVersion: '260318099.0.4', bundleFormat: 'js', ...release,
    package: {format: 'bundle', url: `https://storage.yandexcloud.net/jaco-driver-codepush/${bundleKey}`,
      size: bundle.length, sha256: hash, entrypoint: platform === 'android' ? 'index.android.bundle' : 'main.jsbundle'},
    storageContract: {driverOfflineCache: 1, offlineMaps: 1}};
  const envelope = (value: unknown) => {
    const payloadBytes = Buffer.from(JSON.stringify(value) + '\n');
    return Buffer.from(JSON.stringify({keyId, payloadBase64: payloadBytes.toString('base64'),
      signatureBase64: sign('sha256', Buffer.concat([Buffer.from('jaco-driver-codepush-manifest-v1\n'), payloadBytes]),
        {key: key.privateKey, dsaEncoding: 'der'}).toString('base64')}) + '\n');
  };
  const manifest = envelope(payload);
  const manifestKey = `${prefix}/manifest.json`;
  const runtimeFile = path.join(directory, 'runtime.json');
  const releaseFile = path.join(directory, 'release.json');
  const runtimeBytes = JSON.stringify({schemaVersion: 1, artifactSha256: 'f'.repeat(64), descriptor});
  const outputs: Record<string, Buffer | string> = {
    [`publish/${bundleKey}`]: bundle, [`publish/${manifestKey}`]: manifest,
    'metadata/runtime.json': runtimeBytes, 'metadata/payload.json': JSON.stringify(payload) + '\n',
    'metadata/signing-public-key.pem': key.publicKey.export({type: 'spki', format: 'pem'}),
  };
  for (const [file, bytes] of Object.entries(outputs)) {
    fs.mkdirSync(path.dirname(path.join(prepared, file)), {recursive: true});
    fs.writeFileSync(path.join(prepared, file), bytes);
  }
  fs.writeFileSync(runtimeFile, runtimeBytes);
  fs.writeFileSync(releaseFile, JSON.stringify(release));
  return {root, prepared, runtimeFile, releaseFile, keyFile, keyId, descriptor, bundle, payload,
    bundleKey, manifestKey, manifest, envelope};
}
