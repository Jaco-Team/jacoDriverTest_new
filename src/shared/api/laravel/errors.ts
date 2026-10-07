import type { AxiosError } from 'axios'

export interface LaravelRecoveryMetadata {
  captcha_required?: boolean
  retry_after?: number
  locked?: boolean
  resend_after?: number
}

interface LaravelErrorPayload extends LaravelRecoveryMetadata {
  errors?: Record<string, string | string[]>
  message?: string
  text?: string
}

export interface LaravelApiErrorInfo {
  captchaRequired: boolean
  message: string
  status: number | null
  retryAfter?: number
}

export function positiveRecoverySeconds(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined
}

export function getLaravelRecoveryMetadata(payload: unknown): LaravelRecoveryMetadata {
  if (!payload || typeof payload !== 'object') return {}
  const value = payload as LaravelRecoveryMetadata
  const retryAfter = positiveRecoverySeconds(value.retry_after)
  const resendAfter = positiveRecoverySeconds(value.resend_after)
  return {
    ...(typeof value.captcha_required === 'boolean' ? { captcha_required: value.captcha_required } : {}),
    ...(typeof value.locked === 'boolean' ? { locked: value.locked } : {}),
    ...(retryAfter ? { retry_after: retryAfter } : {}),
    ...(resendAfter ? { resend_after: resendAfter } : {}),
  }
}

function firstValidationMessage(payload: LaravelErrorPayload): string {
  if (!payload.errors) {
    return ''
  }

  for (const value of Object.values(payload.errors)) {
    if (Array.isArray(value) && value.length > 0) {
      return String(value[0] ?? '')
    }

    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return ''
}

export function getLaravelApiErrorInfo(error: unknown): LaravelApiErrorInfo {
  const axiosError = error as AxiosError<LaravelErrorPayload>
  const payload = axiosError.response?.data
  const status = axiosError.response?.status ?? null
  const validationMessage = payload ? firstValidationMessage(payload) : ''
  const retryAfter = positiveRecoverySeconds(payload?.retry_after)
    ?? positiveRecoverySeconds(axiosError.response?.headers?.['retry-after'] ?? axiosError.response?.headers?.['Retry-After'])

  let message = 'Не удалось выполнить запрос.'

  if (status === 429) {
    message = retryAfter
      ? `Слишком много попыток. Повторите через ${retryAfter} с.`
      : 'Слишком много попыток. Повторите немного позже.'
  } else if (!axiosError.response && axiosError.code) {
    message = 'Не удалось подключиться к серверу.'
  } else if (typeof payload?.text === 'string' && payload.text.trim()) {
    message = payload.text
  } else if (validationMessage) {
    message = validationMessage
  } else if (typeof payload?.message === 'string' && payload.message.trim()) {
    message = payload.message
  } else if (typeof axiosError.message === 'string' && axiosError.message.trim()) {
    message = axiosError.message
  }

  return {
    captchaRequired: payload?.captcha_required === true,
    message,
    status,
    ...(retryAfter ? { retryAfter } : {}),
  }
}
