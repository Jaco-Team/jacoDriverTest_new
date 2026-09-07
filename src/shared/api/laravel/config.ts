export type LaravelApiMode = 'local' | 'production'

const LARAVEL_API_ORIGINS: Record<LaravelApiMode, string> = {
  local: 'http://localhost:8080',
  production: 'https://apidriver.jacochef.ru',
}

export function resolveLaravelApiOrigin(mode: LaravelApiMode): string {
  return LARAVEL_API_ORIGINS[mode]
}

const laravelApiMode: LaravelApiMode =
  process.env.JACO_LARAVEL_API === 'local' ? 'local' : 'production'

const laravelApiOrigin = resolveLaravelApiOrigin(laravelApiMode)

export const laravelApiConfig = {
  mode: laravelApiMode,
  origin: laravelApiOrigin,
  captchaPageUrl: `${laravelApiOrigin}/mobile/captcha`,
  ssoLoginUrl: `${laravelApiOrigin}/auth/sso/login?client=mobile`,
  ssoCallbackUrl: 'jacodriver://auth/sso',
  timeoutMs: 15_000,
} as const
