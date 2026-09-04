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

export async function exchangeLaravelSsoLoginCode(
  loginCode: string,
): Promise<LaravelSsoExchangeResponse> {
  const { data } = await laravelHttp.post<LaravelSsoExchangeResponse>(
    laravelApiRoutes.auth.ssoExchange,
    { login_code: loginCode },
  )

  const token = String(data?.token ?? '').trim()

  if (!token) {
    throw new Error('Сервер не вернул токен авторизации.')
  }

  return { ...data, token }
}

export async function logoutFromLaravel(token: string): Promise<void> {
  await laravelHttp.post(
    laravelApiRoutes.auth.logout,
    undefined,
    { headers: bearerHeaders(token) },
  )
}
