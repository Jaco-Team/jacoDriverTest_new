import React, {memo} from 'react'
import {faCircle} from '@fortawesome/free-solid-svg-icons'
import {Marker} from 'react-native-yamap-plus'

import type {MarkerBitmap} from '@/features/orders-map/ui/MeasuredMarkerImage'
import {MeasuredMarkerImage} from '@/features/orders-map/ui/MeasuredMarkerImage'

import type {RecommendationRouteMapPoint} from '../model/recommendationRouteMap'

const [viewBoxWidth, viewBoxHeight, , , path] = faCircle.icon

function markerSignature(
  point: RecommendationRouteMapPoint,
  color: string,
  isDark: boolean,
  isAccepted: boolean,
): string {
  return `recommendation:${point.key}:${point.label}:${color}:${isDark}:${isAccepted}`
}

export const RecommendationRouteMarkerImage = memo(
  function RecommendationRouteMarkerImage({
    point,
    color,
    isDark,
    isAccepted,
    onImage,
  }: {
    point: RecommendationRouteMapPoint
    color: string
    isDark: boolean
    isAccepted: boolean
    onImage: (image: MarkerBitmap) => void
  }) {
    return (
      <MeasuredMarkerImage
        signature={markerSignature(point, color, isDark, isAccepted)}
        text={isAccepted ? '✓' : point.label}
        fontSize={isAccepted ? 13 : 12}
        theme="white_border"
        isDark={isDark}
        icon={{
          path: Array.isArray(path) ? path[0] : path,
          viewBoxWidth,
          viewBoxHeight,
          width: 26,
          height: isAccepted ? 22 : 26,
          color,
          anchor: {x: 0.5, y: 0.5},
        }}
        pill={{
          backgroundColor: isAccepted ? color : '#FFFFFF',
          borderColor: color,
          textColor: isAccepted ? '#FFFFFF' : color,
          height: isAccepted ? 22 : 26,
          width: isAccepted ? 22 : 38,
        }}
        testID={`order-recommendation-map-marker-image-${point.key}-${isAccepted ? 'accepted' : 'number'}`}
        onImage={onImage}
      />
    )
  },
)

export const RecommendationRouteMarker = memo(
  function RecommendationRouteMarker({
    point,
    image,
    isAccepted,
    onPress,
    zIndex,
  }: {
    point: RecommendationRouteMapPoint
    image?: MarkerBitmap
    isAccepted: boolean
    onPress?: () => void
    zIndex?: number
  }) {
    return (
      <Marker
        handled={Boolean(onPress)}
        strictTapBounds={Boolean(onPress)}
        point={point.point}
        source={image?.source}
        anchor={image
          ? {
              x: isAccepted ? 0.5 : 1 + 14 / image.width,
              y: 0.5 - point.orderMarkerCenterOffsetY / image.height,
            }
          : undefined}
        scale={1}
        visible={Boolean(image)}
        zIndex={zIndex}
        testID={`order-recommendation-map-marker-${point.key}`}
        onPress={onPress}
      />
    )
  },
)
