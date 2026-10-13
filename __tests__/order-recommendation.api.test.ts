const mockPost = jest.fn()
const mockGetToken = jest.fn()

jest.mock('@/shared/api/laravel/connector', () => ({
  laravelHttp: {post: (...args: unknown[]) => mockPost(...args)},
  bearerHeaders: (token: string) => ({Authorization: `Bearer ${token}`}),
}))

jest.mock('@/shared/lib/laravelAuthTokenStorage', () => ({
  getLaravelAuthToken: () => mockGetToken(),
}))

import {requestOrderRecommendation} from '@/features/order-recommendation/api/orderRecommendation.api'
import type {OrderRecommendationRequest} from '@/features/order-recommendation/model/orderRecommendation.types'
import {laravelApiRoutes} from '@/shared/api/laravel/routes'

const payload: OrderRecommendationRequest = {
  now: '2026-10-09T12:15:00.000Z',
  timezone: 'Europe/Samara',
  point_id: 12,
  courier: null,
  limits: {
    sum: {current: 0, max: 70000, raw: '0 / 70000'},
    count: {current: 1, max: 6, raw: '1 / 6'},
  },
  orders: [],
}

describe('requestOrderRecommendation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('отправляет запрос с Laravel bearer-токеном', async () => {
    const response = {st: true, title: 'Совет'}
    mockGetToken.mockResolvedValue('test-token')
    mockPost.mockResolvedValue({data: response})

    await expect(requestOrderRecommendation(payload)).resolves.toEqual(response)
    expect(mockPost).toHaveBeenCalledWith(
      laravelApiRoutes.orders.suggestRoute,
      payload,
      {headers: {Authorization: 'Bearer test-token'}},
    )
  })

  it('не отправляет запрос без активной Laravel-сессии', async () => {
    mockGetToken.mockResolvedValue('')

    await expect(requestOrderRecommendation(payload)).rejects.toThrow(
      'Сессия истекла. Войдите снова.',
    )
    expect(mockPost).not.toHaveBeenCalled()
  })
})
