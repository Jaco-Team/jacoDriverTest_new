const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  CODE_PUSH_BUCKET, CODE_PUSH_STORAGE_ORIGIN, CODE_PUSH_SIGNATURE_CONTEXT,
  CODE_PUSH_LIMITS, parseStrictJson, parseManifestEnvelope, parseManifestPayload,
  checkManifestCompatibility, checkManifestFreshness,
} = require('./codepush-contract.cjs');
const {validateDescriptor} = require('./codepush-runtime.cjs');

class PreparedError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function requireCondition(value, code = 'prepared_invalid') {
  if (!value) throw new PreparedError(code);
}
function checked(result, code = 'prepared_invalid') {
  requireCondition(result.ok, code);
  return result.value;
}
function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

/** Bounded, nonblocking regular-file reads; paths and crypto errors never escape. */
function readRegular(file, limit) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const info = fs.fstatSync(fd);
    requireCondition(info.isFile() && info.nlink === 1 && info.size > 0 && info.size <= limit);
    const bytes = Buffer.alloc(info.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = fs.readSync(fd, bytes, count, bytes.length - count, null);
      if (!read) break;
      count += read;
    }
    requireCondition(count === info.size);
    return bytes.subarray(0, count);
  } catch { throw new PreparedError('prepared_invalid'); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}

function regularPath(root, relative) {
  const segments = relative.split('/');
  requireCondition(segments.every(segment => segment && segment !== '.' && segment !== '..'));
  let location = path.resolve(root);
  requireCondition(fs.lstatSync(location).isDirectory() && !fs.lstatSync(location).isSymbolicLink());
  for (const segment of segments.slice(0, -1)) {
    location = path.join(location, segment);
    const stat = fs.lstatSync(location);
    requireCondition(stat.isDirectory() && !stat.isSymbolicLink());
  }
  return path.join(location, segments.at(-1));
}

function readRuntimeExport(file) {
  try {
    const value = checked(parseStrictJson(readRegular(file, CODE_PUSH_LIMITS.payloadBytes)));
    requireCondition(value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === 3 && value.schemaVersion === 1 &&
      /^[a-f0-9]{64}$/.test(value.artifactSha256));
    // Publication checks the reviewed artifact, independent of the publishing checkout.
    return validateDescriptor(value.descriptor, {verifySources: false});
  } catch { throw new PreparedError('runtime_invalid'); }
}

function verifyEnvelope(bytes, descriptor, {fresh = false, now = Date.now()} = {}) {
  try {
    const envelope = checked(parseManifestEnvelope(bytes), 'manifest_invalid');
    requireCondition(Object.hasOwn(descriptor.trustedKeys, envelope.keyId), 'signature_invalid');
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(descriptor.trustedKeys[envelope.keyId], 'base64'), type: 'spki', format: 'der',
    });
    const payloadBytes = Buffer.from(envelope.payloadBase64, 'base64');
    requireCondition(crypto.verify('sha256', Buffer.concat([
      Buffer.from(CODE_PUSH_SIGNATURE_CONTEXT), payloadBytes,
    ]), {key: publicKey, dsaEncoding: 'der'}, Buffer.from(envelope.signatureBase64, 'base64')),
    'signature_invalid');
    const payload = checked(parseManifestPayload(payloadBytes), 'manifest_invalid');
    checked(checkManifestCompatibility(payload, descriptor.runtime), 'runtime_mismatch');
    if (fresh) checked(checkManifestFreshness(payload, now), 'manifest_expired');
    return {payload, payloadBytes, publicKey};
  } catch (error) {
    if (error instanceof PreparedError) throw error;
    throw new PreparedError('signature_invalid');
  }
}

function readPrepared(directory, {fresh = false, now} = {}) {
  try {
    const root = path.resolve(directory);
    const descriptor = readRuntimeExport(regularPath(root, 'metadata/runtime.json'));
    const runtime = descriptor.runtime;
    const prefix = `${runtime.platform}/${runtime.nativeRuntimeId}`;
    const manifestKey = `${prefix}/manifest.json`;
    const manifest = readRegular(regularPath(root, `publish/${manifestKey}`), CODE_PUSH_LIMITS.envelopeBytes);
    const verified = verifyEnvelope(manifest, descriptor, {fresh, now});
    const extension = runtime.platform === 'android' ? 'bundle' : 'jsbundle';
    const bundleKey = `${prefix}/releases/${verified.payload.package.sha256}.${extension}`;
    requireCondition(verified.payload.package.url === `${CODE_PUSH_STORAGE_ORIGIN}/${CODE_PUSH_BUCKET}/${bundleKey}`,
      'package_url_invalid');
    const bundle = readRegular(regularPath(root, `publish/${bundleKey}`), CODE_PUSH_LIMITS.packageBytes);
    requireCondition(bundle.length === verified.payload.package.size && digest(bundle) === verified.payload.package.sha256,
      'bundle_invalid');
    const payloadMetadata = readRegular(regularPath(root, 'metadata/payload.json'), CODE_PUSH_LIMITS.payloadBytes);
    requireCondition(payloadMetadata.equals(verified.payloadBytes), 'metadata_invalid');
    const key = crypto.createPublicKey(readRegular(regularPath(root, 'metadata/signing-public-key.pem'), 16 * 1024));
    requireCondition(key.export({type: 'spki', format: 'der'}).equals(
      verified.publicKey.export({type: 'spki', format: 'der'})), 'metadata_invalid');
    return {descriptor, ...verified, manifest, bundle, manifestKey, bundleKey};
  } catch (error) {
    if (error instanceof PreparedError) throw error;
    throw new PreparedError('prepared_invalid');
  }
}

module.exports = {PreparedError, requireCondition, digest, verifyEnvelope, readPrepared};
