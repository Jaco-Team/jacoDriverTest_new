import type { AxiosError } from 'axios'

interface LaravelErrorPayload {
  captcha_required?: boolean
  errors?: Record<string, string | string[]>
  message?: string
  text?: string
}

export interface LaravelApiErrorInfo {
  captchaRequired: boolean
  message: string
  status: number | null
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

  let message = 'Не удалось выполнить запрос.'

  if (!axiosError.response && axiosError.code) {
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
  }
}
