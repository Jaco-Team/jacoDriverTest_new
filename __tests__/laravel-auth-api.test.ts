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
} from '@/shared/api/laravel/auth'

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

    await expect(exchangeLaravelSsoLoginCode('one-time-code')).resolves.toEqual({
      token: 'sso-token',
      token_type: 'Bearer',
    })
    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      '/api/v1/auth/sso/exchange',
      {login_code: 'one-time-code'},
    )

    await expect(exchangeLaravelSsoLoginCode('invalid-code')).rejects.toThrow(
      'Сервер не вернул токен авторизации.',
    )
  })
})
