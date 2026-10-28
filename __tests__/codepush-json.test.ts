import {parseStrictJson} from '@/codePush/json';
import {CODE_PUSH_LIMITS} from '@/codePush/types';

describe('CodePush strict JSON format', () => {
  it('reads valid Unicode, escaped strings and independent object keys from text and bytes', () => {
    const fixture = {
      title: 'Курьер 🚲',
      escaped: 'quote " and slash \\ and newline\n',
      nested: [{id: 1}, {id: 2}],
      empty: {},
      flags: [true, false, null],
    };
    const source = JSON.stringify(fixture);

    expect(parseStrictJson(source)).toEqual({ok: true, value: fixture});
    expect(parseStrictJson(new Uint8Array(Buffer.from(source, 'utf8')))).toEqual({
      ok: true,
      value: fixture,
    });
  });

  it.each([
    '{"appId":"first","appId":"second"}',
    '{"package":{"size":1,"size":2}}',
    '[{"id":1,"id":2}]',
    '{"appId":1,"\\u0061ppId":2}',
    '{"a\\/b":1,"a/b":2}',
    '{"🚲":1,"\\ud83d\\udeb2":2}',
    '{"__proto__":1,"__proto__":2}',
  ])('rejects repeated decoded keys: %s', source => {
    expect(parseStrictJson(source)).toEqual({
      ok: false,
      error: {code: 'json_duplicate_key', field: '$'},
    });
  });

  it('does not mistake a key mentioned in a string or another object for a duplicate', () => {
    const fixture = {
      id: 1,
      text: '"id": 2, {"id": 3}',
      child: {id: 2},
      other: {id: 3},
    };

    expect(parseStrictJson(JSON.stringify(fixture))).toEqual({ok: true, value: fixture});
  });

  it.each([
    '',
    '{"id":1,}',
    '[1,]',
    '{"id":undefined}',
    '{"id":NaN}',
    '{"id":1} {"id":2}',
    '{"id":1} trailing',
    '\uFEFF{"id":1}',
    '{"number":1e309}',
  ])('rejects malformed JSON, trailing data and non-finite numbers: %s', source => {
    expect(parseStrictJson(source)).toMatchObject({ok: false});
  });

  it.each([
    '9007199254740991.1',
    '-9007199254740991.1',
    '1.0',
    '0.1',
    '1e0',
    '1E0',
    '1e-0',
    '9007199254740992',
    '9007199254740993',
    '-9007199254740992',
    '-0',
  ])('rejects noncanonical or unsafe numeric source tokens before rounding: %s', literal => {
    for (const source of [literal, `{"value":${literal}}`, `[0,{"value":${literal}}]`]) {
      expect(parseStrictJson(source)).toMatchObject({ok: false, error: {code: 'json_invalid'}});
    }
  });

  it.each(['0', '1', '-1', '9007199254740991', '-9007199254740991'])
  ('accepts canonical safe integer source tokens: %s', literal => {
    expect(parseStrictJson(`{"value":${literal}}`)).toEqual({ok: true, value: {value: Number(literal)}});
  });

  it('keeps number-like string values unchanged', () => {
    const source = {values: ['1.0', '1e0', '-0', '9007199254740991.1']};
    expect(parseStrictJson(JSON.stringify(source))).toEqual({ok: true, value: source});
  });

  it.each<[string, number[]]>([
    ['isolated continuation', [0x80]],
    ['overlong ASCII', [0xc0, 0xaf]],
    ['overlong three-byte sequence', [0xe0, 0x80, 0xaf]],
    ['truncated multibyte sequence', [0xe2, 0x82]],
    ['wrong continuation', [0xe2, 0x28, 0xa1]],
    ['encoded surrogate', [0xed, 0xa0, 0x80]],
    ['above Unicode maximum', [0xf4, 0x90, 0x80, 0x80]],
    ['unsupported leading byte', [0xf5, 0x80, 0x80, 0x80]],
  ])('rejects invalid UTF-8 bytes: %s', (_name, bytes) => {
    const input = new Uint8Array([0x22, ...bytes, 0x22]);

    expect(parseStrictJson(input)).toEqual({
      ok: false,
      error: {code: 'utf8_invalid', field: '$'},
    });
  });

  it.each(['"\uD800"', '"\uDC00"', '"\\uD800"', '{"\\uDC00":1}'])
  ('rejects lone surrogates in text, escaped values and decoded keys', source => {
    expect(parseStrictJson(source)).toEqual({
      ok: false,
      error: {code: 'utf8_invalid', field: '$'},
    });
  });

  it('measures the byte limit in UTF-8 bytes for both input forms', () => {
    const source = '{"label":"Я🚲"}';
    const bytes = new Uint8Array(Buffer.from(source, 'utf8'));
    expect(bytes.byteLength).toBeGreaterThan(source.length);

    for (const input of [source, bytes]) {
      expect(parseStrictJson(input, bytes.byteLength)).toEqual({
        ok: true,
        value: {label: 'Я🚲'},
      });
      expect(parseStrictJson(input, bytes.byteLength - 1)).toEqual({
        ok: false,
        error: {code: 'input_too_large', field: '$'},
      });
    }
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
  ('rejects an unusable input size limit: %s', maxBytes => {
    expect(parseStrictJson('{}', maxBytes)).toMatchObject({
      ok: false,
      error: {code: 'input_too_large'},
    });
  });

  it('rejects excess nesting before a manifest can be validated', () => {
    const depth = CODE_PUSH_LIMITS.jsonDepth + 1;
    const source = '['.repeat(depth) + '0' + ']'.repeat(depth);

    expect(parseStrictJson(source)).toEqual({
      ok: false,
      error: {code: 'json_too_deep', field: '$'},
    });
  });

  it('parses a permitted-depth document and does not mutate its byte input', () => {
    const depth = CODE_PUSH_LIMITS.jsonDepth;
    const input = new Uint8Array(Buffer.from('['.repeat(depth) + '0' + ']'.repeat(depth)));
    const before = Array.from(input);

    expect(parseStrictJson(input)).toMatchObject({ok: true});
    expect(Array.from(input)).toEqual(before);
  });
});
