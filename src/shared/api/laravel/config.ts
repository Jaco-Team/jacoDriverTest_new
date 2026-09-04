const laravelApiOrigin = __DEV__
  ? 'http://localhost:8080'
  : 'https://apidriver.jacochef.ru'

export const laravelApiConfig = {
  origin: laravelApiOrigin,
  captchaPageUrl: `${laravelApiOrigin}/mobile/captcha`,
  ssoLoginUrl: `${laravelApiOrigin}/auth/sso/login?client=mobile`,
  ssoCallbackUrl: 'jacodriver://auth/sso',
  timeoutMs: 15_000,
} as const
