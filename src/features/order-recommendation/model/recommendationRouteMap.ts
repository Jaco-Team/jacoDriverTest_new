import type {Order} from '@/shared/store/OrdersStoreType'

import {toRecommendationCoordinates} from './recommendationCoordinates'
import type {RecommendationRouteStop} from './orderRecommendation.types'

export interface RecommendationRouteMapPoint {
  key: string
  seq: number
  label: string
  kind: RecommendationRouteStop['kind']
  title: string
  subtitle?: string
  eta?: string | null
  point: {lat: number; lon: number}
  orderIds: number[]
  orderMarkerCenterOffsetY: number
}

interface WorkingRouteMapPoint extends RecommendationRouteMapPoint {
  hasStart: boolean
  pickupCount: number
  deliveryCount: number
  addresses: string[]
  etaStart?: string | null
  etaEnd?: string | null
}

function orderCountLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  const ending =
    mod10 === 1 && mod100 !== 11
      ? 'заказ'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'заказа'
        : 'заказов'

  return `${count} ${ending}`
}

function pointTitle(point: WorkingRouteMapPoint): string {
  const parts: string[] = []

  if (point.hasStart) parts.push('Старт здесь')
  if (point.pickupCount > 0) {
    parts.push(`Забрать ${orderCountLabel(point.pickupCount)} в кафе`)
  }
  if (point.deliveryCount > 0) {
    parts.push(`Доставить ${orderCountLabel(point.deliveryCount)}`)
  }

  return parts.join(' · ') || point.title
}

function pointSubtitle(addresses: string[]): string | undefined {
  const unique = [...new Set(addresses.filter(Boolean))]
  if (unique.length === 0) return undefined
  if (unique.length === 1) return unique[0]

  return `${unique[0]} · ещё адресов: ${unique.length - 1}`
}

export function buildRecommendationRouteMapPoints(
  stops: RecommendationRouteStop[],
  orderById: Map<number, Order>,
): RecommendationRouteMapPoint[] {
  const points: WorkingRouteMapPoint[] = []
  let previousCoordinateKey: string | null = null

  stops.forEach((stop, index) => {
    const order = stop.id ? orderById.get(stop.id) : undefined
    const orderCoordinates = stop.kind === 'delivery' && order?.xy
      ? toRecommendationCoordinates(
          order.xy.lat ?? order.xy.latitude,
          order.xy.lon ?? order.xy.longitude,
        )
      : null
    const coordinates = orderCoordinates
      ?? toRecommendationCoordinates(stop.lat, stop.lon)

    if (!coordinates) {
      previousCoordinateKey = null
      return
    }

    const seq = index + 1
    const coordinateKey = `${coordinates.lat.toFixed(6)},${coordinates.lon.toFixed(6)}`
    const title = stop.kind === 'start'
      ? 'Текущее местоположение'
      : `${stop.kind === 'pickup' ? 'Забрать' : 'Доставить'} ${order?.id_text || `№${stop.id}`}`
    const address = stop.kind === 'delivery' ? order?.addr : undefined
    const previousPoint = points.at(-1)

    // Группируем только соседние шаги: возврат к той же
    // координате позже должен остаться отдельным шагом маршрута.
    if (previousPoint && coordinateKey === previousCoordinateKey) {
      previousPoint.label = `${previousPoint.seq}–${seq}`
      if (
        stop.kind === 'delivery' ||
        (stop.kind === 'pickup' && previousPoint.kind === 'start')
      ) {
        previousPoint.kind = stop.kind
      }
      previousPoint.hasStart ||= stop.kind === 'start'
      previousPoint.pickupCount += stop.kind === 'pickup' ? 1 : 0
      previousPoint.deliveryCount += stop.kind === 'delivery' ? 1 : 0
      if (address) previousPoint.addresses.push(address)
      if (stop.id !== null && !previousPoint.orderIds.includes(stop.id)) {
        previousPoint.orderIds.push(stop.id)
      }
      if (stop.kind === 'delivery' && order?.close_time_) {
        previousPoint.orderMarkerCenterOffsetY = -10
      }
      if (stop.eta) previousPoint.etaEnd = stop.eta
      return
    }

    points.push({
      key: `${stop.kind}-${stop.id ?? 'start'}-${stop.seq}`,
      seq,
      label: `${seq}`,
      kind: stop.kind,
      title,
      eta: stop.eta,
      point: coordinates,
      orderIds: stop.id === null ? [] : [stop.id],
      orderMarkerCenterOffsetY:
        stop.kind === 'delivery' && order?.close_time_ ? -10 : 0,
      hasStart: stop.kind === 'start',
      pickupCount: stop.kind === 'pickup' ? 1 : 0,
      deliveryCount: stop.kind === 'delivery' ? 1 : 0,
      addresses: address ? [address] : [],
      etaStart: stop.eta,
      etaEnd: stop.eta,
    })
    previousCoordinateKey = coordinateKey
  })

  return points.map(
    ({hasStart, pickupCount, deliveryCount, addresses, etaStart, etaEnd, ...point}) => ({
      ...point,
      title: pointTitle({
        ...point,
        hasStart,
        pickupCount,
        deliveryCount,
        addresses,
        etaStart,
        etaEnd,
      }),
      subtitle: pointSubtitle(addresses),
      eta: etaStart && etaEnd && etaStart !== etaEnd
        ? `${etaStart}–${etaEnd}`
        : etaStart,
    }),
  )
}

export function buildYandexMapsRouteUrl(
  points: RecommendationRouteMapPoint[],
): string | null {
  if (points.length < 2) return null

  const routeText = points
    .map(({point}) => `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`)
    .join('~')

  return `https://yandex.ru/maps/?rtext=${routeText}&rtt=auto`
}

interface NativeRouteResult {
  routes?: Array<{
    sections?: Array<{
      points?: Array<{lat?: unknown; lon?: unknown}>
    }>
  }>
}

// yamap-plus 6.11 on iOS can put `status` and `success` into reversed fields.
// Geometry itself is still valid, so its presence is the reliable success signal.
export function extractRecommendationRoadPoints(
  result: NativeRouteResult,
): Array<{lat: number; lon: number}> {
  return (result.routes?.[0]?.sections ?? [])
    .flatMap(section => section.points ?? [])
    .map(point => toRecommendationCoordinates(point.lat, point.lon))
    .filter((point): point is {lat: number; lon: number} => Boolean(point))
}
