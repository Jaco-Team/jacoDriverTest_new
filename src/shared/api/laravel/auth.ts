import { Platform } from 'react-native'

import { bearerHeaders, laravelHttp } from './connector'
import { laravelApiRoutes } from './routes'

export interface LaravelAuthUser {
  appointment_id: number | null
  auth_mode?: string
  city_id: number | null
  login: string | null
  name: string | null
  point_id: number | null
  user_id: number | null
}

export interface LaravelTokenLoginResponse extends LaravelAuthUser {
  token: string
  token_type: string
}

export interface LaravelMeResponse extends LaravelAuthUser {
  settings: Record<string, unknown>
}

export interface LaravelSsoExchangeResponse {
  token: string
  token_type: string
}

export interface LaravelSsoLoginBinding {
  /** Остаётся в приложении и предъявляется при обмене кода входа. */
  codeVerifier: string
  /** Уходит в адрес входа, который открывается в браузере. */
  codeChallenge: string
}

export async function loginWithLaravel(
  login: string,
  password: string,
  captchaToken: string = '',
): Promise<LaravelTokenLoginResponse> {
  const { data } = await laravelHttp.post<LaravelTokenLoginResponse>(
    laravelApiRoutes.auth.tokenLogin,
    {
      login: login.trim(),
      password,
      device_name: `jaco-driver-${Platform.OS}`,
      ...(captchaToken ? { captcha_token: captchaToken } : {}),
    },
  )

  const token = String(data?.token ?? '').trim()

  if (!token) {
    throw new Error('Сервер не вернул токен авторизации.')
  }

  return { ...data, token }
}

export async function fetchLaravelMe(token: string): Promise<LaravelMeResponse> {
  const { data } = await laravelHttp.get<LaravelMeResponse>(
    laravelApiRoutes.auth.me,
    { headers: bearerHeaders(token) },
  )

  return data
}

/**
 * Пара для привязки кода входа к приложению. Её выдаёт сервер: в приложении нет
 * криптографического генератора случайных чисел без отдельного нативного модуля.
 */
export async function requestLaravelSsoLoginBinding(): Promise<LaravelSsoLoginBinding> {
  const { data } = await laravelHttp.post<{
    code_verifier?: unknown
    code_challenge?: unknown
    code_challenge_method?: unknown
  }>(laravelApiRoutes.auth.ssoPkce)

  const codeVerifier = typeof data?.code_verifier === 'string' ? data.code_verifier.trim() : ''
  const codeChallenge = typeof data?.code_challenge === 'string' ? data.code_challenge.trim() : ''

  if (!codeVerifier || !codeChallenge || data?.code_challenge_method !== 'S256') {
    throw new Error('Сервер не выдал данные для входа через SSO.')
  }

  return { codeVerifier, codeChallenge }
}

export async function exchangeLaravelSsoLoginCode(
  loginCode: string,
  codeVerifier: string,
): Promise<LaravelSsoExchangeResponse> {
  const { data } = await laravelHttp.post<LaravelSsoExchangeResponse>(
    laravelApiRoutes.auth.ssoExchange,
    { login_code: loginCode, code_verifier: codeVerifier },
  )

  const token = String(data?.token ?? '').trim()

  if (!token) {
    throw new Error('Сервер не вернул токен авторизации.')
  }

  return { ...data, token }
}

export type LaravelRecoveryChannel = 'sms' | 'telegram' | 'voice'

const KNOWN_RECOVERY_CHANNELS: readonly LaravelRecoveryChannel[] = ['sms', 'telegram', 'voice']

export interface LaravelRecoveryOptions {
  channels: LaravelRecoveryChannel[]
  /** Нужна ли CAPTCHA перед отправкой кода. */
  captchaRequired: boolean
}

export interface LaravelRecoveryResult {
  st: boolean
  text: string
  /** Код отказа сервера: account_not_found, invalid_code, too_many_requests и т. д. */
  errorCode: string
  retryAfter: number
  resendAfter: number
  captchaRequired: boolean
}

function recoverySeconds(value: unknown): number {
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : 0
}

function toRecoveryResult(payload: unknown, fallbackText: string): LaravelRecoveryResult {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const st = record.st === true
  const text = typeof record.text === 'string' && record.text.trim() ? record.text : ''

  return {
    st,
    text: text || (st ? '' : fallbackText),
    errorCode: typeof record.error_code === 'string' ? record.error_code : '',
    retryAfter: recoverySeconds(record.retry_after),
    resendAfter: recoverySeconds(record.resend_after),
    captchaRequired: record.captcha_required === true,
  }
}

/** Отказ сервер присылает тем же телом, что и успех, но со статусом 4xx. */
function recoveryFailure(error: unknown, fallbackText: string): LaravelRecoveryResult {
  const payload = (error as { response?: { data?: unknown } } | null)?.response?.data
  const result = toRecoveryResult(payload, fallbackText)

  return { ...result, st: false, text: result.text || fallbackText }
}

/**
 * Что сервер примет при восстановлении пароля: способы получения кода и нужна ли
 * CAPTCHA. Если ответа нет, остаётся SMS с обязательной CAPTCHA, как раньше.
 */
export async function fetchLaravelRecoveryOptions(): Promise<LaravelRecoveryOptions> {
  try {
    const { data } = await laravelHttp.get<{ channels?: unknown; captcha_required?: unknown }>(
      laravelApiRoutes.auth.passwordRecoveryChannels,
    )
    const channels = Array.isArray(data?.channels)
      ? KNOWN_RECOVERY_CHANNELS.filter(channel => (data.channels as unknown[]).includes(channel))
      : []

    return {
      channels: channels.length > 0 ? channels : ['sms'],
      captchaRequired: data?.captcha_required !== false,
    }
  } catch {
    return { channels: ['sms'], captchaRequired: true }
  }
}

export async function requestLaravelRecoveryCode(
  login: string,
  channel: LaravelRecoveryChannel,
  captchaToken: string = '',
): Promise<LaravelRecoveryResult> {
  const fallback = 'Не удалось запросить код. Попробуйте позже.'

  try {
    const { data } = await laravelHttp.post<unknown>(laravelApiRoutes.auth.passwordRecoveryRequestCode, {
      login,
      delivery_channel: channel,
      ...(captchaToken ? { captcha_token: captchaToken } : {}),
    })

    return toRecoveryResult(data, fallback)
  } catch (error) {
    return recoveryFailure(error, fallback)
  }
}

export async function resetLaravelPasswordWithCode(
  login: string,
  code: string,
  password: string,
): Promise<LaravelRecoveryResult> {
  const fallback = 'Не удалось обновить пароль. Попробуйте позже.'

  try {
    const { data } = await laravelHttp.post<unknown>(laravelApiRoutes.auth.passwordRecoveryReset, {
      login,
      code,
      password,
    })

    return toRecoveryResult(data, fallback)
  } catch (error) {
    return recoveryFailure(error, fallback)
  }
}

export async function logoutFromLaravel(token: string): Promise<void> {
  await laravelHttp.post(
    laravelApiRoutes.auth.logout,
    undefined,
    { headers: bearerHeaders(token) },
  )
}
