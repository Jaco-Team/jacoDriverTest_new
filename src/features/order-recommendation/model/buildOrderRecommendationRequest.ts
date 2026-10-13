import type {Order} from '@/shared/store/OrdersStoreType'

import type {
  OrderRecommendationRequest,
  RecommendationCoordinates,
  RecommendationLimit,
} from './orderRecommendation.types'
import {toRecommendationCoordinates} from './recommendationCoordinates'

function toInteger(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? 0), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function toStatus(value: unknown): number | null {
  const status = toInteger(value)
  return status >= 1 && status <= 6 ? status : null
}

function toBooleanFlag(value: unknown): boolean {
  return toInteger(value) === 1
}

function toLimit(value: string): RecommendationLimit {
  const numbers = value.match(/\d[\d\s]*/g)?.map(item => Number(item.replace(/\s/g, ''))) ?? []

  if (numbers.length >= 2) {
    return {
      current: numbers[0],
      max: numbers[numbers.length - 1],
      raw: value,
    }
  }

  return {
    current: null,
    max: numbers[0] ?? null,
    raw: value,
  }
}

function toNullableText(value: unknown): string | null {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function toNullableNumber(value: unknown): number | null {
  const normalized = String(value ?? '')
    .replace(/\s/g, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return normalized && Number.isFinite(parsed) ? parsed : null
}

const DRIVER_TIMEZONE = 'Europe/Samara'

export function buildOrderRecommendationRequest({
  orders,
  pointId,
  limit,
  limitCount,
  courier,
  now = new Date(),
  timezone = DRIVER_TIMEZONE,
}: {
  orders: Order[]
  pointId: number | null
  limit: string
  limitCount: string
  courier: RecommendationCoordinates | null
  now?: Date
  timezone?: string
}): OrderRecommendationRequest {
  const normalizedPointId = Number(pointId)

  return {
    now: now.toISOString(),
    timezone,
    point_id:
      Number.isInteger(normalizedPointId) && normalizedPointId > 0 ? normalizedPointId : null,
    courier: courier ? toRecommendationCoordinates(courier.lat, courier.lon) : null,
    limits: {
      sum: toLimit(limit),
      count: toLimit(limitCount),
    },
    orders: orders.map(order => ({
      id: order.id,
      status: toStatus(order.status_order),
      is_preorder: toBooleanFlag(order.is_pred),
      is_mine: toBooleanFlag(order.is_my),
      ready_at: toNullableText(order.time_start_order ?? order.time_start_mini),
      deliver_by: toNullableText(order.need_time ?? order.close_time_),
      remaining_time: toNullableText(order.to_time),
      amount: toNullableNumber(order.sum_order),
      volume: {
        pizza: toInteger(order.count_pizza),
        pasta: toInteger(order.count_pasta),
        rolls: toInteger(order.count_other),
        drinks: toInteger(order.count_drink),
      },
      payment:
        order.online_pay === undefined || order.online_pay === null
          ? null
          : toBooleanFlag(order.online_pay)
            ? 'online'
            : 'cash',
      xy: toRecommendationCoordinates(
        order.xy?.latitude ?? order.xy?.lat,
        order.xy?.longitude ?? order.xy?.lon,
      ),
    })),
  }
}
