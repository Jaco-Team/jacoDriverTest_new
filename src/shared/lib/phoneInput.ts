export interface ParsedPhone {
  /** Что показываем в поле: +7 (999) 123-45-67. */
  display: string
  /** Что отправляем на сервер: +79991234567 или 89991234567. */
  apiValue: string
  valid: boolean
}

/** Тот же разбор номера, что на странице входа SSO и в ШЭФ: принимаем +7 и 8, показываем маску. */
export function parsePhoneInput(value: string): ParsedPhone {
  const raw = String(value ?? '').trim()
  const digits = raw.replace(/\D/g, '')

  if (!raw) return { display: '', apiValue: '', valid: false }
  if (raw === '+') return { display: '+', apiValue: '+', valid: false }

  if ((raw.startsWith('+') && !raw.startsWith('+7')) || !/^[789+]/.test(raw)) {
    return { display: raw, apiValue: raw.replace(/[^\d+]/g, ''), valid: false }
  }

  const prefix = raw.startsWith('8') ? '8' : '+7'
  const national = /^[78]/.test(digits) ? digits.slice(1) : digits

  if (national.length > 10) {
    return { display: `${prefix}${national}`, apiValue: `${prefix}${national}`, valid: false }
  }

  const number = national.slice(0, 10)
  let display = prefix

  if (number.length) display += ` (${number.slice(0, 3)}`
  if (number.length > 3) display += `) ${number.slice(3, 6)}`
  if (number.length > 6) display += `-${number.slice(6, 8)}`
  if (number.length > 8) display += `-${number.slice(8, 10)}`

  return { display, apiValue: `${prefix}${number}`, valid: /^9\d{9}$/.test(national) }
}

/** +7 (999) ***-**-67 — номер на шаге ввода кода. */
export function maskPhone(value: string): string {
  const { apiValue } = parsePhoneInput(value)
  const prefix = apiValue.startsWith('8') ? '8' : '+7'
  const national = apiValue.replace(/\D/g, '').slice(1)

  return `${prefix} (${national.slice(0, 3)}) ***-**-${national.slice(-2)}`
}

/** 0:29 — обратный отсчёт до повторной отправки. */
export function formatCountdown(seconds: number): string {
  const remaining = Math.max(0, Math.ceil(Number(seconds) || 0))

  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
}

export const PHONE_FORMAT_ERROR = 'Введите номер в формате +7 или 8'
