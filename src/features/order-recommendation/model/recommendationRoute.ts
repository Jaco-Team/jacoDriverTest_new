import type {Order} from '@/shared/store/OrdersStoreType'

import type {RecommendationRouteStop} from './orderRecommendation.types'

export function sortRecommendationStops(
  stops?: RecommendationRouteStop[] | null,
): RecommendationRouteStop[] {
  return (stops ?? []).slice().sort((left, right) => left.seq - right.seq)
}

export function recommendationStopLabel(
  stop: RecommendationRouteStop,
  order?: Order,
): string {
  if (stop.kind === 'start') return 'Текущее местоположение'

  const action = stop.kind === 'pickup' ? 'Забрать' : 'Доставить'
  const orderLabel = order?.id_text || `№${stop.id}`
  const address = stop.kind === 'delivery' && order?.addr
    ? ` · ${order.addr}`
    : ''

  return `${action} ${orderLabel}${address}`
}

export function formatRecommendationDistance(
  distanceMeters?: number | null,
): string | null {
  if (!distanceMeters || distanceMeters <= 0) return null
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} м`

  return `${(distanceMeters / 1000).toFixed(1)} км`
}
