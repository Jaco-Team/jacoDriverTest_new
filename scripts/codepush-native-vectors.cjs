const crypto = require('node:crypto');
const fs = require('node:fs');
const {CODE_PUSH_SIGNATURE_CONTEXT, CODE_PUSH_LIMITS} = require('./codepush-contract.cjs');

const P256_ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');

function integer(value) {
  let hex = value.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  let bytes = Buffer.from(hex, 'hex');
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
  return Buffer.concat([Buffer.from([2, bytes.length]), bytes]);
}

function signatureDER(r, s) {
  const body = Buffer.concat([integer(r), integer(s)]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

function signatureIntegers(bytes) {
  const rLength = bytes[3];
  const sStart = 4 + rLength;
  return [
    BigInt('0x' + bytes.subarray(4, sStart).toString('hex')),
    BigInt('0x' + bytes.subarray(sStart + 2).toString('hex')),
  ];
}

function generateVectors() {
  // Private keys exist only in memory for this test run. Only public keys and
  // signed, artificial input are returned; nothing is installed in an app.
  const first = crypto.generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  const second = crypto.generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  const firstSPKI = first.publicKey.export({format: 'der', type: 'spki'});
  const secondSPKI = second.publicKey.export({format: 'der', type: 'spki'});
  const keyId = 'native-test-first';
  const trustedKeys = {[keyId]: firstSPKI.toString('base64')};
  const payload = Buffer.from(' { "exact": "Курьеры", "value": 1 }\r\n', 'utf8');
  const context = Buffer.from(CODE_PUSH_SIGNATURE_CONTEXT, 'utf8');
  const sign = (bytes, key = first.privateKey, prefix = context) =>
    crypto.sign('sha256', Buffer.concat([prefix, bytes]), {key, dsaEncoding: 'der'});
  const signed = sign(payload);
  const envelope = {
    keyId,
    payloadBase64: payload.toString('base64'),
    signatureBase64: signed.toString('base64'),
  };
  const vectors = [];
  function add(name, input, {keys = trustedKeys, expectedPayload, errors} = {}) {
    const bytes = Buffer.isBuffer(input) ? input : Buffer.from(
      typeof input === 'string' ? input : JSON.stringify(input), 'utf8',
    );
    vectors.push({
      name,
      envelopeBase64: bytes.toString('base64'),
      trustedKeys: keys,
      expectedPayloadBase64: expectedPayload === undefined ? null : expectedPayload.toString('base64'),
      expectedErrorCodes: errors ?? [],
    });
  }
  const good = (name, input, options = {}) => add(name, input, {expectedPayload: payload, ...options});
  const bad = (name, input, errors, options = {}) => add(name, input, {errors: [errors].flat(), ...options});
  const changed = fields => ({...envelope, ...fields});
  const signedEnvelope = bytes => changed({payloadBase64: bytes.toString('base64'), signatureBase64: sign(bytes).toString('base64')});

  good('valid original bytes', envelope);
  good('valid reordered envelope with JSON whitespace', `\n { "signatureBase64" : "${envelope.signatureBase64}",\r\n"payloadBase64":"${envelope.payloadBase64}","keyId":"${keyId}" } \t`);
  good('valid escaped envelope keys', `{"key\\u0049d":"${keyId}","payloadBase\\u00364":"${envelope.payloadBase64}","signatureBase64":"${envelope.signatureBase64}"}`);
  good('valid escaped ASCII key id', JSON.stringify(envelope).replace(keyId, 'native-test-\\u0066irst'));
  good('valid maximum length key id', changed({keyId: 'a'.repeat(64)}), {keys: {['a'.repeat(64)]: trustedKeys[keyId]}});
  const [r, s] = signatureIntegers(signed);
  good('valid high S DER signature', changed({signatureBase64: signatureDER(r, s > P256_ORDER / 2n ? s : P256_ORDER - s).toString('base64')}));
  good('valid low S DER signature', changed({signatureBase64: signatureDER(r, s < P256_ORDER / 2n ? s : P256_ORDER - s).toString('base64')}));
  const rotationKeys = {...trustedKeys, 'native-test-second': secondSPKI.toString('base64')};
  good('valid rotated trusted key', changed({keyId: 'native-test-second', signatureBase64: sign(payload, second.privateKey).toString('base64')}), {keys: rotationKeys});
  good('valid original key during rotation', envelope, {keys: rotationKeys});
  const singleByte = Buffer.from('A');
  good('valid minimum payload', signedEnvelope(singleByte), {expectedPayload: singleByte});
  const binary = Buffer.from([0, 255, 0xc0, 0x80, 0x0a]);
  good('valid opaque bytes are authenticated without decoding payload', signedEnvelope(binary), {expectedPayload: binary});
  const maximumPayload = Buffer.alloc(CODE_PUSH_LIMITS.payloadBytes, 0x61);
  good('valid payload at size limit', signedEnvelope(maximumPayload), {expectedPayload: maximumPayload});
  const original = Buffer.from(JSON.stringify(envelope));
  good('valid envelope at size limit', Buffer.concat([original, Buffer.alloc(CODE_PUSH_LIMITS.envelopeBytes - original.length, 0x20)]));

  bad('missing domain context', changed({signatureBase64: sign(payload, first.privateKey, Buffer.alloc(0)).toString('base64')}), 'signature_invalid');
  bad('wrong domain context', changed({signatureBase64: sign(payload, first.privateKey, Buffer.from('other-app\n')).toString('base64')}), 'signature_invalid');
  bad('payload tampering', changed({payloadBase64: Buffer.concat([payload, Buffer.from(' ')]).toString('base64')}), 'signature_invalid');
  bad('payload normalized after signing', changed({payloadBase64: Buffer.from(JSON.stringify(JSON.parse(payload.toString()))).toString('base64')}), 'signature_invalid');
  const corruptedSignature = Buffer.from(signed);
  corruptedSignature[corruptedSignature.length - 1] ^= 1;
  bad('signature tampering', changed({signatureBase64: corruptedSignature.toString('base64')}), 'signature_invalid');
  bad('different signing key', changed({signatureBase64: sign(payload, second.privateKey).toString('base64')}), 'signature_invalid');
  bad('wrong pinned key', envelope, 'signature_invalid', {keys: {[keyId]: secondSPKI.toString('base64')}});
  bad('unknown key id', changed({keyId: 'unknown'}), 'key_unknown');
  bad('empty trusted keyring', envelope, 'key_unknown', {keys: {}});
  bad('removed old key', envelope, 'key_unknown', {keys: {'native-test-second': secondSPKI.toString('base64')}});
  bad('key id changed to another trusted key', changed({keyId: 'native-test-second'}), 'signature_invalid', {keys: rotationKeys});

  const otherCurve = crypto.generateKeyPairSync('ec', {namedCurve: 'secp384r1'}).publicKey.export({format: 'der', type: 'spki'});
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const noncanonicalKey = trustedKeys[keyId].slice(0, -3) +
    alphabet[alphabet.indexOf(trustedKeys[keyId].at(-3)) ^ 1] + '==';
  const badKeys = [
    ['empty public key', ''],
    ['public key is not base64', '%bad%'],
    ['public key base64 whitespace', trustedKeys[keyId] + '\n'],
    ['public key base64 omitted padding', trustedKeys[keyId].replace(/=+$/, '')],
    ['public key base64 nonzero padding bits', noncanonicalKey],
    ['public key from another curve', otherCurve.toString('base64')],
    ['SPKI trailing bytes', Buffer.concat([firstSPKI, Buffer.from([0])]).toString('base64')],
    ['SPKI invalid algorithm identifier', Buffer.concat([firstSPKI.subarray(0, 10), Buffer.from([0]), firstSPKI.subarray(11)]).toString('base64')],
    ['SPKI compressed point marker', Buffer.concat([firstSPKI.subarray(0, 26), Buffer.from([2]), firstSPKI.subarray(27)]).toString('base64')],
    ['SPKI invalid EC point', Buffer.concat([firstSPKI.subarray(0, 27), Buffer.alloc(64)]).toString('base64')],
  ];
  for (const [name, key] of badKeys) bad(name, envelope, 'key_invalid', {keys: {[keyId]: key}});

  const malformedSignatures = [
    ['zero r', signatureDER(0n, 1n)],
    ['zero s', signatureDER(1n, 0n)],
    ['r equal to curve order', signatureDER(P256_ORDER, 1n)],
    ['s equal to curve order', signatureDER(1n, P256_ORDER)],
    ['r greater than curve order', signatureDER(P256_ORDER + 1n, 1n)],
    ['negative DER integer', Buffer.from([0x30, 6, 2, 1, 0x80, 2, 1, 1])],
    ['nonminimal DER integer', Buffer.from([0x30, 7, 2, 2, 0, 1, 2, 1, 1])],
    ['empty DER integer', Buffer.from([0x30, 5, 2, 0, 2, 1, 1])],
    ['DER trailing bytes', Buffer.concat([signatureDER(1n, 1n), Buffer.from([0])])],
    ['DER long-form length', Buffer.from([0x30, 0x81, 6, 2, 1, 1, 2, 1, 1])],
    ['DER truncated body', signed.subarray(0, signed.length - 1)],
    ['DER wrong sequence tag', Buffer.concat([Buffer.from([0x31]), signed.subarray(1)])],
    ['DER wrong integer tag', Buffer.from([0x30, 6, 3, 1, 1, 2, 1, 1])],
  ];
  for (const [name, bytes] of malformedSignatures) bad(name, changed({signatureBase64: bytes.toString('base64')}), 'signature_invalid');

  for (const [field, values] of [
    ['payloadBase64', ['', '%bad%', 'QQ', 'QQ=', 'QR==', 'QQ==\n', 'QQ-_', 'AAAA=']],
    ['signatureBase64', ['', '%bad%', envelope.signatureBase64 + '\n', signatureDER(1n, 1n).toString('base64').replace(/=+$/, '')]],
  ]) {
    for (let i = 0; i < values.length; i++) bad(`${field} malformed base64 ${i + 1}`, changed({[field]: values[i]}), 'field_invalid');
  }
  bad('payload larger than size limit', changed({payloadBase64: Buffer.alloc(CODE_PUSH_LIMITS.payloadBytes + 1).toString('base64')}), 'field_invalid');
  bad('signature larger than DER size limit', changed({signatureBase64: Buffer.alloc(73).toString('base64')}), 'field_invalid');
  bad('envelope larger than size limit', Buffer.alloc(CODE_PUSH_LIMITS.envelopeBytes + 1, 0x20), 'input_too_large');
  bad('invalid UTF8 envelope', Buffer.from([0xff, 0xc0, 0x80]), 'utf8_invalid');

  bad('duplicate key id', JSON.stringify(envelope).replace('{', `{"keyId":"${keyId}",`), 'json_duplicate_key');
  bad('escaped duplicate key id', JSON.stringify(envelope).replace('{', `{"key\\u0049d":"${keyId}",`), 'json_duplicate_key');
  bad('duplicate payload field', JSON.stringify(envelope).replace('{', `{"payloadBase64":"${envelope.payloadBase64}",`), 'json_duplicate_key');
  bad('unknown envelope field', {...envelope, extra: 'x'}, 'fields_invalid');
  bad('missing envelope field', {keyId, payloadBase64: envelope.payloadBase64}, 'fields_invalid');
  bad('empty envelope object', {}, 'fields_invalid');
  for (const [name, input] of [
    ['top-level array', '[]'],
    ['top-level null', 'null'],
    ['non-string key id', changed({keyId: 1})],
    ['non-string payload', changed({payloadBase64: null})],
    ['non-string signature', changed({signatureBase64: true})],
    ['nested envelope value', changed({payloadBase64: {nested: 'x'}})],
  ]) bad(name, input, ['json_invalid', 'fields_invalid', 'field_invalid']);
  for (const [name, input] of [
    ['empty JSON', ''],
    ['JSON trailing data', JSON.stringify(envelope) + '{}'],
    ['JSON trailing comma', JSON.stringify(envelope).replace(/}$/, ',}')],
    ['JSON comment', '/*comment*/' + JSON.stringify(envelope)],
    ['JSON missing comma', JSON.stringify(envelope).replace(',"payload', '"payload')],
    ['JSON raw control character', JSON.stringify(envelope).replace(keyId, 'bad\nkey')],
    ['JSON unknown escape', JSON.stringify(envelope).replace(keyId, '\\x41')],
    ['JSON high unpaired surrogate', JSON.stringify(envelope).replace(keyId, '\\ud800')],
    ['JSON low unpaired surrogate', JSON.stringify(envelope).replace(keyId, '\\udfff')],
    ['JSON invalid unicode digits', JSON.stringify(envelope).replace(keyId, '\\u00xz')],
    ['JSON non-ASCII digits in unicode escape', JSON.stringify(envelope).replace('keyId', 'key\\u００４９d')],
    ['JSON byte order mark', '\ufeff' + JSON.stringify(envelope)],
    ['JSON non-ASCII whitespace', '\u00a0' + JSON.stringify(envelope)],
  ]) bad(name, input, 'json_invalid');
  for (const [name, id] of [
    ['empty key id', ''],
    ['long key id', 'a'.repeat(65)],
    ['key id initial punctuation', '_key'],
    ['key id slash', 'first/second'],
    ['key id space', 'first second'],
    ['key id non-ASCII', 'ключ'],
    ['key id valid surrogate pair is still non-ASCII', 'test-🚚'],
  ]) bad(name, changed({keyId: id}), 'field_invalid');

  if (new Set(vectors.map(vector => vector.name)).size !== vectors.length) throw new Error('Duplicate native test vector');
  return {schemaVersion: 1, signatureContext: CODE_PUSH_SIGNATURE_CONTEXT, vectors};
}

module.exports = {generateVectors};

if (require.main === module) {
  if (process.argv.length !== 4 || process.argv[2] !== '--out') {
    console.error('Usage: node scripts/codepush-native-vectors.cjs --out /temporary/vectors.json');
    process.exitCode = 1;
  } else {
    const result = generateVectors();
    fs.writeFileSync(process.argv[3], JSON.stringify(result) + '\n', {flag: 'wx', mode: 0o600});
    console.log(`CodePush native vectors: ${result.vectors.length}; ephemeral test public keys only.`);
  }
}
