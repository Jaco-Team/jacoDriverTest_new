export interface ExtractedPhone {
  digits: string
  tel: string
  display: string
}

const PHONE_SEPARATORS = '[\\s\\-().\\u2013\\u2014]'
const ELEVEN_DIGIT_PHONE = new RegExp(
  `(?:\\+7|8|7)(?:${PHONE_SEPARATORS}*\\d){10}`,
  'g',
)
const TEN_DIGIT_MOBILE = new RegExp(
  `9(?:${PHONE_SEPARATORS}*\\d){9}`,
  'g',
)

export function normalizeRuPhoneDigits(value: unknown): string | null {
  let digits = String(value ?? '').replace(/\D/g, '')

  if (digits.length === 10 && digits.startsWith('9')) {
    digits = `7${digits}`
  }

  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`
  }

  if (digits.length !== 11 || !digits.startsWith('7')) {
    return null
  }

  return digits
}

function formatPhoneNumber(phone: unknown): string {
  const source = `${phone ?? ''}`.trim()
  const digits = source.replace(/\D/g, '')

  if (digits.length !== 11) {
    return source
  }

  const prefix = digits[0]
  const rest = digits.slice(1)

  if (rest.startsWith('9')) {
    return `${prefix} (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8, 10)}`
  }

  return `${prefix} (${rest.slice(0, 4)}) ${rest.slice(4, 6)}-${rest.slice(6, 8)}-${rest.slice(8, 10)}`
}

function toExtractedPhone(digits: string): ExtractedPhone {
  return {
    digits,
    tel: `+${digits}`,
    display: formatPhoneNumber(`8${digits.slice(1)}`),
  }
}

function collectMatches(
  source: string,
  pattern: RegExp,
): Array<{ start: number; end: number; value: string }> {
  const matches: Array<{ start: number; end: number; value: string }> = []
  pattern.lastIndex = 0

  let match = pattern.exec(source)
  while (match) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
    })
    match = pattern.exec(source)
  }

  return matches
}

function maskRanges(
  source: string,
  ranges: Array<{ start: number; end: number }>,
): string {
  if (ranges.length === 0) {
    return source
  }

  const chars = source.split('')
  ranges.forEach(({ start, end }) => {
    for (let index = start; index < end; index += 1) {
      chars[index] = ' '
    }
  })

  return chars.join('')
}

export function extractPhonesFromText(text: unknown): ExtractedPhone[] {
  const source = String(text ?? '')
  if (!source.trim()) {
    return []
  }

  const found = new Map<string, ExtractedPhone>()
  const addMatch = (raw: string): void => {
    const digits = normalizeRuPhoneDigits(raw)
    if (!digits || found.has(digits)) {
      return
    }

    found.set(digits, toExtractedPhone(digits))
  }

  const elevenDigitMatches = collectMatches(source, ELEVEN_DIGIT_PHONE)
  elevenDigitMatches.forEach((item) => addMatch(item.value))

  collectMatches(maskRanges(source, elevenDigitMatches), TEN_DIGIT_MOBILE)
    .forEach((item) => addMatch(item.value))

  return [...found.values()]
}
