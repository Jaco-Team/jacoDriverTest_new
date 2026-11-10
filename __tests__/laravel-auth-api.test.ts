const mockPost = jest.fn()
const mockGet = jest.fn()

jest.mock('@/shared/api/laravel/connector', () => ({
  bearerHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
  laravelHttp: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

import {
  exchangeLaravelSsoLoginCode,
  fetchLaravelMe,
  loginWithLaravel,
  logoutFromLaravel,
  fetchLaravelRecoveryOptions,
  requestLaravelRecoveryCode,
  requestLaravelSsoLoginBinding,
  resetLaravelPasswordWithCode,
} from '@/shared/api/laravel/auth'
import { buildLaravelSsoLoginUrl } from '@/shared/api/laravel/config'

describe('Laravel auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('отправляет mobile login в формате Laravel API', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        token: ' token-1 ',
        token_type: 'Bearer',
        login: '79990000001',
      },
    })

    const result = await loginWithLaravel(' 79990000001 ', 'DemoDriver1!')

    expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/token/login', {
      login: '79990000001',
      password: 'DemoDriver1!',
      device_name: 'jaco-driver-ios',
    })
    expect(result.token).toBe('token-1')
  })

  it('не принимает успешный ответ без token', async () => {
    mockPost.mockResolvedValueOnce({ data: { token: '' } })

    await expect(loginWithLaravel('driver', 'password')).rejects.toThrow(
      'Сервер не вернул токен авторизации.',
    )
  })

  it('передаёт CAPTCHA token только когда он получен', async () => {
    mockPost.mockResolvedValueOnce({
      data: { token: 'token-1', token_type: 'Bearer', login: 'driver' },
    })

    await loginWithLaravel('driver', 'password', 'captcha-token')

    expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/token/login', {
      login: 'driver',
      password: 'password',
      device_name: 'jaco-driver-ios',
      captcha_token: 'captcha-token',
    })
  })

  it('передаёт Bearer token в me и logout', async () => {
    mockGet.mockResolvedValueOnce({ data: { login: 'driver', settings: {} } })
    mockPost.mockResolvedValueOnce({ data: { message: 'Logged out' } })

    await expect(fetchLaravelMe('token-1')).resolves.toEqual({
      login: 'driver',
      settings: {},
    })
    await logoutFromLaravel('token-1')

    expect(mockGet).toHaveBeenCalledWith('/api/v1/auth/me', {
      headers: { Authorization: 'Bearer token-1' },
    })
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/auth/logout',
      undefined,
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })

  it('обменивает одноразовый SSO-код и проверяет наличие token', async () => {
    mockPost
      .mockResolvedValueOnce({data: {token: ' sso-token ', token_type: 'Bearer'}})
      .mockResolvedValueOnce({data: {token: ''}})

    await expect(exchangeLaravelSsoLoginCode('one-time-code', 'verifier-1')).resolves.toEqual({
      token: 'sso-token',
      token_type: 'Bearer',
    })
    // Код входа уходит вместе с code_verifier: без него сервер токен не отдаст.
    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      '/api/v1/auth/sso/exchange',
      {login_code: 'one-time-code', code_verifier: 'verifier-1'},
    )

    await expect(exchangeLaravelSsoLoginCode('invalid-code', 'verifier-1')).rejects.toThrow(
      'Сервер не вернул токен авторизации.',
    )
  })

  it('получает пару для привязки кода входа и не принимает неполный ответ', async () => {
    mockPost
      .mockResolvedValueOnce({
        data: {code_verifier: ' verifier-1 ', code_challenge: ' challenge-1 ', code_challenge_method: 'S256'},
      })
      .mockResolvedValueOnce({data: {code_verifier: 'verifier-1', code_challenge: ''}})
      .mockResolvedValueOnce({
        data: {code_verifier: 'verifier-1', code_challenge: 'challenge-1', code_challenge_method: 'plain'},
      })

    await expect(requestLaravelSsoLoginBinding()).resolves.toEqual({
      codeVerifier: 'verifier-1',
      codeChallenge: 'challenge-1',
    })
    expect(mockPost).toHaveBeenNthCalledWith(1, '/api/v1/auth/sso/pkce')

    await expect(requestLaravelSsoLoginBinding()).rejects.toThrow(
      'Сервер не выдал данные для входа через SSO.',
    )
    await expect(requestLaravelSsoLoginBinding()).rejects.toThrow(
      'Сервер не выдал данные для входа через SSO.',
    )
  })

  it('в адрес входа попадает только challenge, не verifier', () => {
    expect(buildLaravelSsoLoginUrl('abc_DEF-123')).toBe(
      'https://apidriver.jacochef.ru/auth/sso/login?client=mobile&code_challenge=abc_DEF-123&code_challenge_method=S256',
    )
  })
})

describe('Laravel password recovery API: сначала код, потом новый пароль', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('читает способы получения кода и требование CAPTCHA, при сбое остаётся SMS с CAPTCHA', async () => {
    mockGet.mockResolvedValueOnce({
      data: { channels: ['voice', 'sms', 'pigeon', 'telegram'], captcha_required: false },
    })
    await expect(fetchLaravelRecoveryOptions()).resolves.toEqual({
      channels: ['sms', 'telegram', 'voice'],
      captchaRequired: false,
    })
    expect(mockGet).toHaveBeenCalledWith('/api/v1/auth/password/recovery/channels')

    // Старый сервер без поля captcha_required: считаем CAPTCHA обязательной.
    mockGet.mockResolvedValueOnce({ data: { channels: [] } })
    await expect(fetchLaravelRecoveryOptions()).resolves.toEqual({ channels: ['sms'], captchaRequired: true })

    mockGet.mockRejectedValueOnce(new Error('offline'))
    await expect(fetchLaravelRecoveryOptions()).resolves.toEqual({ channels: ['sms'], captchaRequired: true })
  })

  it('запрашивает код выбранным способом и одинаково читает отказ из 200 и из 4xx', async () => {
    mockPost.mockResolvedValueOnce({ data: { st: true, text: 'Запрос принят', resend_after: 30 } })
    await expect(requestLaravelRecoveryCode('+79991234567', 'telegram', 'captcha-token')).resolves.toEqual({
      st: true,
      text: 'Запрос принят',
      errorCode: '',
      retryAfter: 0,
      resendAfter: 30,
      captchaRequired: false,
    })
    expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/password/recovery/request-code', {
      login: '+79991234567',
      delivery_channel: 'telegram',
      captcha_token: 'captcha-token',
    })

    mockPost.mockResolvedValueOnce({
      data: { st: false, error_code: 'account_not_found', text: 'Аккаунт с таким номером не найден.' },
    })
    await expect(requestLaravelRecoveryCode('+79991234567', 'sms')).resolves.toMatchObject({
      st: false,
      errorCode: 'account_not_found',
      text: 'Аккаунт с таким номером не найден.',
    })
    expect(mockPost).toHaveBeenLastCalledWith('/api/v1/auth/password/recovery/request-code', {
      login: '+79991234567',
      delivery_channel: 'sms',
    })

    mockPost.mockRejectedValueOnce({
      response: { status: 429, data: { st: false, error_code: 'too_many_requests', retry_after: 17.2 } },
    })
    await expect(requestLaravelRecoveryCode('+79991234567', 'sms')).resolves.toMatchObject({
      st: false,
      errorCode: 'too_many_requests',
      retryAfter: 18,
      text: 'Не удалось запросить код. Попробуйте позже.',
    })
  })

  it('отправляет код вместе с новым паролем', async () => {
    mockPost.mockResolvedValueOnce({ data: { st: true, text: 'Пароль успешно обновлен!' } })
    await expect(resetLaravelPasswordWithCode('+79991234567', '123456', 'NewPassword9')).resolves.toMatchObject({
      st: true,
    })
    expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/password/recovery/reset', {
      login: '+79991234567',
      code: '123456',
      password: 'NewPassword9',
    })

    mockPost.mockRejectedValueOnce(new Error('network'))
    await expect(resetLaravelPasswordWithCode('+79991234567', '123456', 'NewPassword9')).resolves.toMatchObject({
      st: false,
      text: 'Не удалось обновить пароль. Попробуйте позже.',
    })
  })
})
