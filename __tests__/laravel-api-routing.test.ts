const mockGet = jest.fn()
const mockPost = jest.fn()
const mockGetLaravelAuthToken = jest.fn()
const mockClearLaravelAuthToken = jest.fn()

jest.mock('@/shared/api/laravel/connector', () => ({
  bearerHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
  laravelHttp: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

jest.mock('@/shared/lib/laravelAuthTokenStorage', () => ({
  getLaravelAuthToken: (...args: unknown[]) => mockGetLaravelAuthToken(...args),
  clearLaravelAuthToken: (...args: unknown[]) => mockClearLaravelAuthToken(...args),
}))

import { api } from '@/shared/store/api'

describe('Laravel API compatibility routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetLaravelAuthToken.mockResolvedValue('secure-token')
    mockClearLaravelAuthToken.mockResolvedValue(undefined)
    ;(global as any).__FAKE_ORDERS__ = 'off'
  })

  it('routes orders through Laravel and removes internal token', async () => {
    mockPost.mockResolvedValueOnce({ data: { st: true, orders: [] } })

    const result = await api('orders', {
      type: 'get_orders',
      token: 'must-not-be-sent',
      type_orders: 2,
      point_id: 15,
    })

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/orders/get_orders',
      { type_orders: 2, point_id: 15 },
      { headers: { Authorization: 'Bearer secure-token' } },
    )
    expect(result.st).toBe(true)
  })

  it('normalizes settings response and cancelled-order period', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        settings: { point_id: 15, type_show_del: 'full' },
        all_points: [{ id: 15, name: 'Самара' }],
      },
    })

    await expect(api('settings', { type: 'getMySetting' })).resolves.toEqual({
      st: true,
      text: '',
      data: {
        point_id: 15,
        type_show_del: 'full',
        all_points: [{ id: 15, name: 'Самара' }],
      },
    })

    mockPost.mockResolvedValueOnce({
      data: { message: 'Settings saved', settings: { type_show_del: 'full' } },
    })
    await api('settings', { type: 'saveMySetting', type_show_del: 'full' })

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/settings/save',
      { type_show_del: 1440 },
      { headers: { Authorization: 'Bearer secure-token' } },
    )
  })

  it('maps current-day price and graph month field to the mobile contract', async () => {
    mockPost
      .mockResolvedValueOnce({ data: { stat: {}, give_hist: [] } })
      .mockResolvedValueOnce({
        data: {
          month: [
            { day: '2026-09', month: 'Сентябрь', is_active: 1 },
          ],
          errs: {},
        },
      })

    await api('price', { type: 'get_my_price', date: '2026-09-03' })
    const graph = await api<any>('graph', { type: 'get_my_graph', date: '2026-09' })

    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      '/api/v1/price/between',
      { dateStart: '2026-09-03', dateEnd: '2026-09-03' },
      { headers: { Authorization: 'Bearer secure-token' } },
    )
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      '/api/v1/graph',
      { date: '2026-09' },
      { headers: { Authorization: 'Bearer secure-token' } },
    )
    expect(graph.data.mounth).toEqual([
      {
        day: '2026-09',
        month: 'Сентябрь',
        mounth: 'Сентябрь',
        is_active: 1,
      },
    ])
  })

  it('allows unauthenticated password-recovery requests only', async () => {
    mockGetLaravelAuthToken.mockResolvedValueOnce('')
    mockPost.mockResolvedValueOnce({ data: { st: true } })

    await api('auth', {
      type: 'get_sms',
      login: '79990000001',
      pwd: 'NewPassword1!',
      captcha_token: 'captcha-token',
    })

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/auth/password/recovery/send-code',
      {
        login: '79990000001',
        password: 'NewPassword1!',
        captcha_token: 'captcha-token',
      },
      {},
    )

    mockGetLaravelAuthToken.mockResolvedValueOnce('')
    await expect(api('orders', { type: 'get_orders', type_orders: 1 })).resolves.toEqual({
      st: false,
      text: 'Сессия истекла. Войдите снова.',
    })
  })

  it('clears the protected session when Laravel returns 401', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Unauthenticated.' } },
    })

    const result = await api('orders', { type: 'get_orders', type_orders: 1 })

    expect(result).toEqual({ st: false, text: 'Unauthenticated.' })
    expect(mockClearLaravelAuthToken).toHaveBeenCalledTimes(1)
  })
})
