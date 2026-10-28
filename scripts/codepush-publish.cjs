const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {CODE_PUSH_STORAGE_ORIGIN, CODE_PUSH_BUCKET, CODE_PUSH_LIMITS} = require('./codepush-contract.cjs');
const {PreparedError, requireCondition, digest, readPrepared, verifyEnvelope} = require('./codepush-prepared.cjs');

function publicObject(key, maxBytes) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (error) reject(new PreparedError(error)); else resolve(value);
    };
    const request = https.get(`${CODE_PUSH_STORAGE_ORIGIN}/${CODE_PUSH_BUCKET}/${key}`, {
      headers: {'Cache-Control': 'no-cache', 'Accept-Encoding': 'identity'},
    }, response => {
      if (response.statusCode === 404) {
        response.destroy(); finish(null, {status: 404}); return;
      }
      if (response.statusCode !== 200 ||
          (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
        response.destroy(); finish('public_read_failed'); return;
      }
      const length = response.headers['content-length'];
      if (length !== undefined && (!/^(0|[1-9]\d*)$/.test(length) || Number(length) > maxBytes)) {
        response.destroy(); finish('remote_object_invalid'); return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) { response.destroy(); finish('remote_object_invalid'); }
        else chunks.push(chunk);
      });
      response.on('end', () => {
        if (length !== undefined && Number(length) !== size) { finish('remote_object_invalid'); return; }
        finish(null, {status: 200, bytes: Buffer.concat(chunks), etag: response.headers.etag ?? '',
          cacheControl: response.headers['cache-control'] ?? ''});
      });
      response.on('error', () => finish('public_read_failed'));
      response.on('aborted', () => finish('public_read_failed'));
    });
    const deadline = setTimeout(() => { request.destroy(); finish('public_read_timeout'); }, 120_000);
    request.setTimeout(30_000, () => { request.destroy(); finish('public_read_timeout'); });
    request.on('error', () => finish('public_read_failed'));
  });
}

function awsTransport(profile, spawn = spawnSync) {
  requireCondition(typeof profile === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(profile), 'profile_invalid');
  return {
    read: publicObject,
    put(key, file, bytes, condition, manifest) {
      const args = ['s3api', 'put-object', '--endpoint-url', CODE_PUSH_STORAGE_ORIGIN,
        '--region', 'ru-central1', '--profile', profile, '--bucket', CODE_PUSH_BUCKET,
        '--key', key, '--body', file, '--content-length', String(bytes.length),
        '--content-md5', crypto.createHash('md5').update(bytes).digest('base64'),
        '--content-type', manifest ? 'application/json' : 'application/javascript',
        '--cache-control', manifest ? 'no-store, max-age=0' : 'public, max-age=31536000, immutable',
        condition.etag ? '--if-match' : '--if-none-match', condition.etag || '*',
        '--output', 'json', '--no-cli-pager', '--no-cli-auto-prompt'];
      const result = spawn('aws', args, {shell: false, encoding: 'utf8', timeout: 180_000,
        maxBuffer: 16 * 1024, env: {...process.env, AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off',
          AWS_REQUEST_CHECKSUM_CALCULATION: 'when_required', AWS_RESPONSE_CHECKSUM_VALIDATION: 'when_required',
          AWS_MAX_ATTEMPTS: '1'}});
      if (result.error || result.status !== 0 || result.signal) {
        // Never forward subprocess output: it may contain credentials or signed headers.
        const conflict = /\b(?:PreconditionFailed|ConditionalRequestConflict|412|409)\b/.test(result.stderr ?? '');
        throw new PreparedError(conflict ? 'publication_conflict' : 'upload_failed');
      }
    },
  };
}

function validResponse(response, maxBytes) {
  requireCondition(response && [200, 404].includes(response.status), 'public_read_failed');
  if (response.status === 200) requireCondition(Buffer.isBuffer(response.bytes) && response.bytes.length <= maxBytes,
    'remote_object_invalid');
  return response;
}
function verifyBundle(response, item) {
  requireCondition(response.status === 200 && response.bytes.length === item.bundle.length &&
    digest(response.bytes) === item.payload.package.sha256, 'remote_bundle_invalid');
}
function conditionFor(response) {
  if (response.status === 404) return {};
  requireCondition(typeof response.etag === 'string' && /^"[A-Za-z0-9-]{1,128}"$/.test(response.etag), 'remote_etag_invalid');
  return {etag: response.etag};
}
function verifyManifestCache(response) {
  requireCondition(typeof response.cacheControl === 'string' &&
    /(?:^|,)\s*no-store(?:\s*,|\s*$)/i.test(response.cacheControl), 'manifest_cache_invalid');
}

/** Offline by default. Only --execute permits the two conditional writes. */
async function publishPrepared(options, dependencies = {}) {
  const item = readPrepared(options.prepared, {fresh: true, now: dependencies.now});
  const summary = {status: 'prepared', platform: item.payload.platform,
    nativeRuntimeId: item.payload.nativeRuntimeId, version: item.payload.version,
    manifestSequence: item.payload.manifestSequence, packageSha256: item.payload.package.sha256};
  if (!options.execute) return summary;
  const transport = dependencies.transport ?? awsTransport(options.profile ?? 'mini-codepush');
  const current = validResponse(await transport.read(item.manifestKey, CODE_PUSH_LIMITS.envelopeBytes), CODE_PUSH_LIMITS.envelopeBytes);
  let same = false;
  if (current.status === 200) {
    const previous = verifyEnvelope(current.bytes, item.descriptor);
    same = previous.payload.manifestSequence === item.payload.manifestSequence &&
      previous.payloadBytes.equals(item.payloadBytes);
    requireCondition(same || previous.payload.manifestSequence < item.payload.manifestSequence,
      'manifest_sequence_conflict');
  }
  const condition = conditionFor(current);
  const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), 'jaco-codepush-publish-'));
  fs.chmodSync(snapshot, 0o700);
  try {
    const bundleFile = path.join(snapshot, 'bundle');
    const manifestFile = path.join(snapshot, 'manifest.json');
    fs.writeFileSync(bundleFile, item.bundle, {mode: 0o600, flag: 'wx'});
    fs.writeFileSync(manifestFile, item.manifest, {mode: 0o600, flag: 'wx'});
    const existing = validResponse(await transport.read(item.bundleKey, item.bundle.length), item.bundle.length);
    if (existing.status === 404) {
      try { await transport.put(item.bundleKey, bundleFile, item.bundle, {}, false); }
      catch (error) {
        // A parallel writer may have created the same content-addressed object.
        if (!(error instanceof PreparedError) || error.code !== 'publication_conflict') throw error;
      }
    }
    verifyBundle(validResponse(await transport.read(item.bundleKey, item.bundle.length), item.bundle.length), item);
    if (same) {
      verifyManifestCache(current);
      return {...summary, status: 'already_published'};
    }
    // The manifest is the last write, conditional on the exact version read above.
    await transport.put(item.manifestKey, manifestFile, item.manifest, condition, true);
    const published = validResponse(await transport.read(item.manifestKey, CODE_PUSH_LIMITS.envelopeBytes), CODE_PUSH_LIMITS.envelopeBytes);
    requireCondition(published.status === 200 && published.bytes.equals(item.manifest), 'manifest_verification_failed');
    verifyManifestCache(published);
    return {...summary, status: 'published'};
  } finally { fs.rmSync(snapshot, {recursive: true, force: true}); }
}

function parseArguments(argv) {
  const result = {execute: false};
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === '--execute') {
      requireCondition(!result.execute, 'arguments_invalid'); result.execute = true; continue;
    }
    const field = argument === '--prepared' ? 'prepared' : argument === '--profile' ? 'profile' : undefined;
    requireCondition(field && !Object.hasOwn(result, field) && typeof argv[i + 1] === 'string' &&
      argv[i + 1].length > 0 && !argv[i + 1].startsWith('--'), 'arguments_invalid');
    result[field] = argv[++i];
  }
  requireCondition(typeof result.prepared === 'string', 'arguments_invalid');
  return result;
}
module.exports = {publishPrepared, parseArguments, awsTransport, publicObject};
if (require.main === module) {
  Promise.resolve().then(() => publishPrepared(parseArguments(process.argv.slice(2))))
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      console.error(`CodePush publication: ${error instanceof PreparedError ? error.code : 'publication_failed'}`);
      process.exitCode = 1;
    });
}
