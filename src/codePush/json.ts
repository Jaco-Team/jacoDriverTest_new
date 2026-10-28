import {CODE_PUSH_LIMITS, type FormatCheck} from './types';

class JsonFailure extends Error {
  constructor(
    readonly code:
      'json_invalid' | 'json_duplicate_key' | 'json_too_deep' | 'utf8_invalid',
  ) {
    super(code);
  }
}

function utf8Length(text: string): number {
  let size = 0;
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) size += 1;
    else if (unit < 0x800) size += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new JsonFailure('utf8_invalid');
      i += 1;
      size += 4;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new JsonFailure('utf8_invalid');
    } else size += 3;
  }
  return size;
}

function decodeUtf8(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++];
    let point: number;
    let remaining: number;
    let minimum: number;
    if (first <= 0x7f) {
      parts.push(String.fromCharCode(first));
      continue;
    } else if (first >= 0xc2 && first <= 0xdf) {
      point = first & 0x1f;
      remaining = 1;
      minimum = 0x80;
    } else if (first >= 0xe0 && first <= 0xef) {
      point = first & 0x0f;
      remaining = 2;
      minimum = 0x800;
    } else if (first >= 0xf0 && first <= 0xf4) {
      point = first & 0x07;
      remaining = 3;
      minimum = 0x10000;
    } else throw new JsonFailure('utf8_invalid');
    for (let n = 0; n < remaining; n += 1) {
      const next = bytes[i++];
      if (next === undefined || next < 0x80 || next > 0xbf)
        throw new JsonFailure('utf8_invalid');
      point = (point << 6) | (next & 0x3f);
    }
    if (
      point < minimum ||
      point > 0x10ffff ||
      (point >= 0xd800 && point <= 0xdfff)
    ) {
      throw new JsonFailure('utf8_invalid');
    }
    parts.push(String.fromCodePoint(point));
  }
  return parts.join('');
}

// JSON.parse checks grammar; this bounded walk also rejects duplicate decoded keys.
function checkTokens(text: string): void {
  let offset = 0;
  const whitespace = () => {
    while (/\s/.test(text[offset] ?? '') && offset < text.length) offset += 1;
  };
  const string = (): string => {
    const start = offset++;
    while (offset < text.length) {
      const current = text[offset++];
      if (current === '\\') offset += 1;
      else if (current === '"') {
        const decoded = JSON.parse(text.slice(start, offset)) as string;
        utf8Length(decoded);
        return decoded;
      }
    }
    throw new JsonFailure('json_invalid');
  };
  const value = (depth: number): void => {
    if (depth > CODE_PUSH_LIMITS.jsonDepth)
      throw new JsonFailure('json_too_deep');
    whitespace();
    const current = text[offset];
    if (current === '{' || current === '[') {
      const object = current === '{';
      const end = object ? '}' : ']';
      const keys = new Set<string>();
      offset += 1;
      whitespace();
      if (text[offset] === end) {
        offset += 1;
        return;
      }
      while (offset < text.length) {
        whitespace();
        if (object) {
          const key = string();
          if (keys.has(key)) throw new JsonFailure('json_duplicate_key');
          keys.add(key);
          whitespace();
          offset += 1; // Colon, already checked by JSON.parse.
        }
        value(depth + 1);
        whitespace();
        if (text[offset++] === end) return;
      }
    } else if (current === '"') string();
    else {
      const start = offset;
      while (offset < text.length && !/[\s,\]}]/.test(text[offset]))
        offset += 1;
      const token = text.slice(start, offset);
      if (
        token !== 'true' &&
        token !== 'false' &&
        token !== 'null' &&
        (!/^(?:0|-?[1-9][0-9]*)$/.test(token) ||
          !Number.isSafeInteger(Number(token)))
      ) {
        // Every numeric field in protocol v1 is an integer. Reject raw fractional
        // or exponent tokens before their rounding can differ across runtimes.
        throw new JsonFailure('json_invalid');
      }
    }
  };
  value(0);
}

export function parseStrictJson(
  input: string | Uint8Array,
  maxBytes = CODE_PUSH_LIMITS.payloadBytes,
): FormatCheck<unknown> {
  try {
    if (!(typeof input === 'string' || input instanceof Uint8Array))
      throw new JsonFailure('json_invalid');
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1 ||
      input.length > maxBytes
    ) {
      return {ok: false, error: {code: 'input_too_large', field: '$'}};
    }
    const size =
      typeof input === 'string' ? utf8Length(input) : input.byteLength;
    if (size > maxBytes) {
      return {ok: false, error: {code: 'input_too_large', field: '$'}};
    }
    const text = typeof input === 'string' ? input : decodeUtf8(input);
    const parsed: unknown = JSON.parse(text);
    checkTokens(text);
    return {ok: true, value: parsed};
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error instanceof JsonFailure ? error.code : 'json_invalid',
        field: '$',
      },
    };
  }
}
