const mockPost = jest.fn()

jest.mock('@/shared/api/laravel/connector', () => ({
  laravelHttp: { post: (...args: any[]) => mockPost(...args) },
  bearerHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
}))
jest.mock('@/shared/api/laravel/config', () => ({
  laravelApiConfig: { mode: 'production' },
}))
jest.mock('@/shared/lib/laravelAuthTokenStorage', () => ({
  getLaravelAuthToken: jest.fn().mockResolvedValue('test-token'),
  clearLaravelAuthToken: jest.fn(),
}))

import { laravelApiRoutes } from '@/shared/api/laravel/routes'
import { api } from '@/shared/store/api'

describe('Laravel order coordinate contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    globalThis.__FAKE_ORDERS__ = 'off'
    mockPost.mockResolvedValue({ data: { st: true, text: '' } })
  })

  it.each([1, 2, 3])('отправляет числовые GPS-координаты строками для действия %s', async typeAction => {
    const input = {
      type: 'actionOrder', id: 123, type_action: typeAction,
      latitude: 53.5123456789, longitude: 49.4123456789,
    }

    const result = await api('orders', input)

    expect(result.st).toBe(true)
    expect(mockPost).toHaveBeenCalledWith(
      laravelApiRoutes.orders.actionOrder,
      { ...input, latitude: '53.5123456789', longitude: '49.4123456789' },
      { headers: { Authorization: 'Bearer test-token' } },
    )
    expect(input.latitude).toBe(53.5123456789)
    expect(input.longitude).toBe(49.4123456789)
  })

  it('отправляет строки и для отметки «клиент не вышел на связь», включая нулевые координаты', async () => {
    await api('orders', {
      type: 'checkFakeOrder', order_id: 123, latitude: 0, longitude: -49.4,
    })

    expect(mockPost).toHaveBeenCalledWith(
      laravelApiRoutes.orders.checkFakeOrder,
      { type: 'checkFakeOrder', order_id: 123, latitude: '0', longitude: '-49.4' },
      expect.any(Object),
    )
  })

  it.each([
    { latitude: '53.5', longitude: '49.4' },
    { latitude: '', longitude: '' },
    { latitude: null, longitude: null },
    {},
  ])('сохраняет допустимые строковые и отсутствующие координаты: %s', async coordinates => {
    const input = { type: 'actionOrder', id: 123, type_action: 3, ...coordinates }
    await api('orders', input)
    expect(mockPost).toHaveBeenCalledWith(
      laravelApiRoutes.orders.actionOrder, input, expect.any(Object),
    )
  })

  it('оставляет координаты числами в запросе сохранения текущей позиции', async () => {
    await api('settings', { type: 'save_my_pos', latitude: 53.5, longitude: 49.4 })
    expect(mockPost).toHaveBeenCalledWith(
      laravelApiRoutes.settings.savePosition,
      { latitude: 53.5, longitude: 49.4 },
      expect.any(Object),
    )
  })
})
