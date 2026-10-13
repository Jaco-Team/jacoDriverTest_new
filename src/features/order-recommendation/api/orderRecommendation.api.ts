import {getLaravelAuthToken} from '@/shared/lib/laravelAuthTokenStorage'
import {bearerHeaders, laravelHttp} from '@/shared/api/laravel/connector'
import {laravelApiRoutes} from '@/shared/api/laravel/routes'

import type {
  OrderRecommendationRequest,
  OrderRecommendationResult,
} from '../model/orderRecommendation.types'

export async function requestOrderRecommendation(
  payload: OrderRecommendationRequest,
): Promise<OrderRecommendationResult> {
  const token = await getLaravelAuthToken()

  if (!token) {
    throw new Error('Сессия истекла. Войдите снова.')
  }

  const {data} = await laravelHttp.post<OrderRecommendationResult>(
    laravelApiRoutes.orders.suggestRoute,
    payload,
    {headers: bearerHeaders(token)},
  )

  return data
}
