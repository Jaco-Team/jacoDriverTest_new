import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Polyline, Transport, type Point, type YamapRef} from 'react-native-yamap-plus'

import type {MarkerBitmap} from '@/features/orders-map/ui/MeasuredMarkerImage'
import {useOrdersStore} from '@/shared/store/store'
import {useAppTheme} from '@/shared/theme/AppThemeProvider'

import {sortRecommendationStops} from '../model/recommendationRoute'
import {
  buildRecommendationRouteMapPoints,
  extractRecommendationRoadPoints,
} from '../model/recommendationRouteMap'
import {useOrderRecommendationStore} from '../model/orderRecommendation.store'
import {
  RecommendationRouteMarker,
  RecommendationRouteMarkerImage,
} from './RecommendationRouteMarker'

interface MapRefLike {
  current: YamapRef | null
}

export type RecommendationRouteMarkerImages = Record<string, MarkerBitmap>

function markerImageKey(pointKey: string, isAccepted: boolean): string {
  return `${pointKey}:${isAccepted ? 'accepted' : 'number'}`
}

const RecommendationRouteMarkerImageSource = memo(
  function RecommendationRouteMarkerImageSource({
    point,
    color,
    isDark,
    isAccepted,
    onImage,
  }: {
    point: ReturnType<typeof buildRecommendationRouteMapPoints>[number]
    color: string
    isDark: boolean
    isAccepted: boolean
    onImage: (key: string, image: MarkerBitmap) => void
  }) {
    const acceptImage = useCallback(
      (image: MarkerBitmap) => onImage(markerImageKey(point.key, isAccepted), image),
      [isAccepted, onImage, point.key],
    )

    return (
      <RecommendationRouteMarkerImage
        point={point}
        color={color}
        isDark={isDark}
        isAccepted={isAccepted}
        onImage={acceptImage}
      />
    )
  },
)

export function ActiveOrderRecommendationMarkerSources({
  points,
  onImage,
}: {
  points: ReturnType<typeof buildRecommendationRouteMapPoints>
  onImage: (key: string, image: MarkerBitmap) => void
}): React.JSX.Element {
  const {colors, isDark} = useAppTheme()

  return (
    <>
      {points.flatMap(point =>
        [false, true].map(isAccepted => (
          <RecommendationRouteMarkerImageSource
            key={markerImageKey(point.key, isAccepted)}
            point={point}
            color={isAccepted ? colors.aiAccepted : colors.aiRoute}
            isDark={isDark}
            isAccepted={isAccepted}
            onImage={onImage}
          />
        )),
      )}
    </>
  )
}

export function useActiveOrderRecommendationRoute(
  mapRef: MapRefLike,
  mapInstanceKey: number,
) {
  const result = useOrderRecommendationStore(state => state.result)
  const isRouteVisible = useOrderRecommendationStore(state => state.isRouteVisible)
  const orderTypeId = useOrderRecommendationStore(state => state.orderTypeId)
  const acceptedOrderIds = useOrderRecommendationStore(state => state.acceptedOrderIds)
  const unavailableOrderIds = useOrderRecommendationStore(state => state.unavailableOrderIds)
  const orderSnapshots = useOrderRecommendationStore(state => state.orderSnapshots)
  const orders = useOrdersStore(state => state.orders)
  const currentOrderTypeId = useOrdersStore(state => state.type.id)
  const isCurrentRouteVisible = isRouteVisible && orderTypeId === currentOrderTypeId
  const unavailableIds = useMemo(
    () => new Set(unavailableOrderIds),
    [unavailableOrderIds],
  )
  const orderById = useMemo(
    () => new Map(
      [...Object.values(orderSnapshots), ...orders]
        .map(order => [order.id, order] as const),
    ),
    [orderSnapshots, orders],
  )
  const stops = useMemo(
    () => sortRecommendationStops(result?.route?.stops).filter(
      stop => stop.id === null || !unavailableIds.has(stop.id),
    ),
    [result?.route?.stops, unavailableIds],
  )
  const points = useMemo(
    () => buildRecommendationRouteMapPoints(stops, orderById),
    [orderById, stops],
  )
  const directPoints = useMemo(() => points.map(item => item.point), [points])
  const [roadPoints, setRoadPoints] = useState<Point[]>([])
  const [markerImages, setMarkerImages] = useState<RecommendationRouteMarkerImages>({})
  const fittedRouteRef = useRef('')
  const routeKey = useMemo(
    () => points.map(point => `${point.key}:${point.point.lat}:${point.point.lon}`).join('|'),
    [points],
  )
  const saveMarkerImage = useCallback((key: string, image: MarkerBitmap) => {
    setMarkerImages(current =>
      current[key]?.signature === image.signature
        ? current
        : {...current, [key]: image},
    )
  }, [])

  useEffect(() => {
    const keys = new Set(points.flatMap(point => [
      markerImageKey(point.key, false),
      markerImageKey(point.key, true),
    ]))
    setMarkerImages(current => {
      const entries = Object.entries(current).filter(([key]) => keys.has(key))
      return entries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(entries)
    })
  }, [points])

  useEffect(() => {
    if (!isCurrentRouteVisible || directPoints.length < 2) {
      setRoadPoints([])
      return
    }

    let active = true
    let resolved = false
    let attempts = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    setRoadPoints([])

    const calculateRoute = () => {
      attempts += 1
      void Transport.findDrivingRoutes(directPoints)
        .then(resultValue => {
          if (!active || resolved) return
          const geometry = extractRecommendationRoadPoints(resultValue)
          if (geometry.length <= 1) throw new Error('Empty route geometry')
          resolved = true
          if (retryTimer) clearTimeout(retryTimer)
          setRoadPoints(geometry)
        })
        .catch(() => {
          if (!active || resolved) return
          if (attempts < 2) {
            retryTimer = setTimeout(calculateRoute, 250)
          } else {
            setRoadPoints(directPoints)
          }
        })
    }

    calculateRoute()
    // На Android нативный запрос иногда зависает без resolve/reject. Повторная
    // сессия не даёт подборке остаться без линии маршрута.
    retryTimer = setTimeout(() => {
      if (active && !resolved && attempts < 2) calculateRoute()
    }, 2500)

    return () => {
      active = false
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [directPoints, isCurrentRouteVisible, routeKey])

  useEffect(() => {
    if (!isCurrentRouteVisible || directPoints.length === 0 || !mapRef.current) return
    const fitKey = `${mapInstanceKey}:${routeKey}`
    if (fittedRouteRef.current === fitKey) return

    const timer = setTimeout(() => {
      if (!mapRef.current) return
      try {
        if (directPoints.length === 1) {
          mapRef.current.setCenter(directPoints[0], 15, 0, 0, 0.32)
        } else {
          mapRef.current.fitMarkers(directPoints, 0.32)
        }
        fittedRouteRef.current = fitKey
      } catch {
        // Карта может пересоздаваться при смене темы или восстановлении сети.
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [directPoints, isCurrentRouteVisible, mapInstanceKey, mapRef, routeKey])

  return {
    isRouteVisible: isCurrentRouteVisible && points.length > 0,
    acceptedOrderIds,
    linePoints: roadPoints,
    markerImages,
    points,
    saveMarkerImage,
  }
}

export function ActiveOrderRecommendationRouteLayer({
  acceptedOrderIds,
  linePoints,
  markerImages,
  points,
}: {
  acceptedOrderIds: number[]
  linePoints: Point[]
  markerImages: RecommendationRouteMarkerImages
  points: ReturnType<typeof buildRecommendationRouteMapPoints>
}): React.JSX.Element {
  const {colors} = useAppTheme()
  const acceptedIds = useMemo(() => new Set(acceptedOrderIds), [acceptedOrderIds])

  return (
    <>
      {linePoints.length > 1 ? (
        <Polyline
          points={linePoints}
          strokeColor={colors.aiRouteLine}
          strokeWidth={4}
          outlineColor="rgba(255, 255, 255, 0.88)"
          outlineWidth={1}
          testID="order-recommendation-active-route-line"
        />
      ) : null}
      {points.map((point, index) => {
        const isAccepted = point.orderIds.length > 0
          && point.orderIds.every(id => acceptedIds.has(id))
        return (
          <RecommendationRouteMarker
            key={point.key}
            point={point}
            image={markerImages[markerImageKey(point.key, isAccepted)]}
            isAccepted={isAccepted}
            zIndex={120 + index}
          />
        )
      })}
    </>
  )
}
