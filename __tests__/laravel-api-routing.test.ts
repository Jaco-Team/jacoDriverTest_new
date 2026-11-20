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
import { laravelApiConfig } from '@/shared/api/laravel/config'

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
      {
        headers: { Authorization: 'Bearer secure-token' },
        timeout: laravelApiConfig.mode === 'local' ? 60_000 : 30_000,
      },
    )
    expect(result.st).toBe(true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([
    {mode: 'local' as const, timeout: 45_000 as const},
    {mode: 'production' as const, timeout: 15_000 as const},
  ])('keeps the original completion retryable with the $mode request budget', async ({mode, timeout}) => {
    jest.replaceProperty(laravelApiConfig, 'mode', mode)
    jest.replaceProperty(laravelApiConfig, 'timeoutMs', timeout)
    const command = {
      type: 'actionOrder', id: 937369, type_action: 3, point_id: 1,
      completed_at: '2026-11-20T08:12:02.948Z', latitude: '', longitude: '',
    }
    mockPost
      .mockRejectedValueOnce({isAxiosError: true, code: 'ECONNABORTED', message: 'timeout exceeded'})
      .mockResolvedValueOnce({data: {st: true}})

    const first = await api('orders', command)
    const second = await api('orders', command)

    expect(first.st).toBe(false)
    expect(first.retryable).toBe(true)
    expect(second.st).toBe(true)
    for (const call of [1, 2]) {
      expect(mockPost).toHaveBeenNthCalledWith(call, '/api/v1/orders/action_order', command, {
        headers: {Authorization: 'Bearer secure-token'}, timeout,
      })
    }
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

  it('sends the selected cafe with the settings request when given', async () => {
    mockGet.mockResolvedValueOnce({ data: { settings: { point_id: 15 }, all_points: [] } })

    await api('settings', { type: 'getMySetting', point_id: 22 })

    expect(mockGet).toHaveBeenCalledWith('/api/v1/settings/get', {
      headers: { Authorization: 'Bearer secure-token' },
      params: { point_id: 22 },
    })
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

  it('refuses protected requests without a token', async () => {
    mockGetLaravelAuthToken.mockResolvedValueOnce('')

    await expect(api('orders', { type: 'get_orders', type_orders: 1 })).resolves.toEqual({
      st: false,
      text: 'Сессия истекла. Войдите снова.',
    })
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('clears the protected session when Laravel returns 401', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Unauthenticated.' } },
    })

    const result = await api('orders', { type: 'get_orders', type_orders: 1 })

    expect(result).toEqual({ st: false, text: 'Unauthenticated.', retryable: false })
    expect(mockClearLaravelAuthToken).toHaveBeenCalledTimes(1)
  })
  it.each([401, 429])('retains a saved completion after HTTP %s without changing ordinary request behavior', async status => {
    mockPost.mockRejectedValueOnce({
      response: {status, data: {message: status === 401 ? 'Unauthenticated.' : 'Too Many Attempts.'}},
    })
    const result = await api('orders', {
      type: 'actionOrder', type_action: 3, id: 123, point_id: 10,
      completed_at: '2026-11-20T10:00:00.000Z', latitude: '53.5', longitude: '49.4',
    })
    expect(result.st).toBe(false)
    expect(result.retryable).toBe(true)
    expect(mockClearLaravelAuthToken).toHaveBeenCalledTimes(status === 401 ? 1 : 0)
  })

  it('сохраняет ожидание из ответа сервера: 200 с блокировкой и транспортный 429', async () => {
    mockPost.mockResolvedValueOnce({ data: { st: false, text: 'Подождите.', locked: true, retry_after: 60 } })
    expect(await api('orders', { type: 'get_orders', type_orders: 1 }))
      .toEqual(expect.objectContaining({ st: false, locked: true, retry_after: 60 }))

    mockPost.mockRejectedValueOnce({ response: { status: 429,
      headers: { 'retry-after': '30' }, data: { message: 'Too Many Attempts.' },
    } })
    expect(await api('orders', { type: 'get_orders', type_orders: 1 }))
      .toEqual(expect.objectContaining({ st: false, locked: true, retry_after: 30,
        text: 'Слишком много попыток. Повторите через 30 с.' }))
  })

})
