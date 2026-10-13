import type {Order} from '@/shared/store/OrdersStoreType'

export function buildOrderRecommendationSignature({
  orders,
  pointId,
  limit,
  limitCount,
}: {
  orders: Order[]
  pointId: number | null
  limit: string
  limitCount: string
}): string {
  return JSON.stringify({
    pointId,
    limit,
    limitCount,
    orders: orders
      .map(order => ({
        id: order.id,
        status: order.status_order,
        isMine: order.is_my,
        readyAt: order.time_start_order ?? order.time_start_mini,
        deliverBy: order.need_time ?? order.close_time_,
        remaining: order.to_time,
        amount: order.sum_order,
      }))
      .sort((left, right) => left.id - right.id),
  })
}
