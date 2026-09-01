import React, { memo, useCallback, useMemo, useRef } from 'react'
import { PixelRatio, Platform, type ImageSourcePropType, View } from 'react-native'
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg'

import { faTruckFast } from '@fortawesome/free-solid-svg-icons'
import { Marker } from 'react-native-yamap-plus'

import type { Theme } from '@/shared/types/globalTypes'

import { useDriverMarkerLogic } from '../model/useDriverMarkerLogic'

const DRIVER_MARKER_WIDTH = 96
const DRIVER_ICON_SIZE = 24
const DRIVER_TEXT_LEFT = 29
const DRIVER_TIME_MIN_FONT_SIZE = 16
const DRIVER_FALLBACK_WIDTH = 80
const DRIVER_MARKER_FALLBACK: ImageSourcePropType = {
  uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABACAMAAAC6GQAEAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAABgUExURQAAAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAAAAAMWCKEYAAAAedFJOUwAANZHgKEMBs/GwUwZbkgyulA45DwQXrK0dHlx3eaDxh6AAAAABYktHRACIBR1IAAAAB3RJTUUH6ggfDRMgEVhsRQAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyNi0wOC0zMVQxMzoxOTozMiswMDowMI5whJoAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjYtMDgtMzFUMTM6MTk6MzIrMDA6MDD/LTwmAAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDI2LTA4LTMxVDEzOjE5OjMyKzAwOjAwqDgd+QAAAWJJREFUWMPtmOcOgzAMhEsp0AUddI+8/2N2RWAHk8SJ1UoV9zO6fr3EOMiMRoNkNU4nykeTdOyDy/xompk5eTkD91LuysfkKWXPWHD2q3ddWOvB5illrUwaAExtQP6On3umizENQGnJFNcBjMhHA2N48gk/ms0XS6EzbFXKVBmosrbNW6s1i7hxE7e8jG5iwty1k8hM6CQyz7AhClX5oyoR6OViA1ZKiV5GRJFehkSZ2wYQhe7Dlih1YxfdpZDnj7hX4zrEE+jfwz9KGHuGor0c+xxSQNl8sb38lYTiZyheZfM5GoD/DOxMAfVzsbb+lnQ0QHNO2b1XdxYe7WiAxiRV6+X+jD2O9rWF97zXy/teIO0AsxBu6sT5fqEdcEJF83JgQjxDw4k+6Ay7Uz745sCuct93iANM0Pz7geXAOhJhTkwH0pmwX5gOrLLjvrIdWDfDfQ9w2BJcgxzGObbnfjzzHA8O1Zd9slg9hAAAAABJRU5ErkJggg==',
}
const [truckViewBoxWidth, truckViewBoxHeight, , , truckPathData] = faTruckFast.icon
const truckPath = Array.isArray(truckPathData) ? truckPathData[0] : truckPathData

export interface DriverMarkerImageSource {
  signature: string
  source: ImageSourcePropType
}

interface DriverMarkerImageProps {
  onImage: (image: DriverMarkerImageSource) => void
}

interface DriverMarkerProps {
  image: DriverMarkerImageSource | null
}

function getMarkerHeight(globalFontSize: number): number {
  const fontSize = Math.max(globalFontSize, DRIVER_TIME_MIN_FONT_SIZE)
  return Math.max(DRIVER_ICON_SIZE + 8, Math.ceil(fontSize + 16))
}

function getCapturePixelRatio(platformOS = Platform.OS, pixelRatio = PixelRatio.get()): number {
  // Android decodes a data-URI PNG as a raw bitmap. Yandex MapKit then treats
  // its physical pixels as the icon size, so an image made in RN layout units
  // becomes several times smaller on a high-density screen. Render the SVG at
  // the device density; iOS already preserves the expected point size.
  return platformOS === 'android' ? pixelRatio : 1
}

export function getDriverMarkerCaptureSize(
  markerHeight: number,
  platformOS = Platform.OS,
  pixelRatio = PixelRatio.get(),
): { width: number; height: number } {
  const capturePixelRatio = getCapturePixelRatio(platformOS, pixelRatio)
  return {
    width: Math.round(DRIVER_MARKER_WIDTH * capturePixelRatio),
    height: Math.round(markerHeight * capturePixelRatio),
  }
}

export function getDriverMarkerNativeScale(
  mapScale: number,
  hasCapturedImage: boolean,
  platformOS = Platform.OS,
  pixelRatio = PixelRatio.get(),
): number {
  if (hasCapturedImage) return mapScale

  const densityScale = platformOS === 'android' ? pixelRatio : 1
  return mapScale * densityScale * (DRIVER_ICON_SIZE / DRIVER_FALLBACK_WIDTH)
}

function getMarkerSignature(
  lat: number,
  lon: number,
  timeText: string,
  globalFontSize: number,
  theme: Theme,
): string {
  return `${lat}:${lon}:${timeText}:${globalFontSize}:${theme}`
}

function getMarkerPalette(theme: Theme): {
  background: string
  border: string
  borderWidth: number
  text: string
  opacity: number
} {
  if (theme === 'transparent') {
    return { background: 'transparent', border: 'transparent', borderWidth: 0, text: '#000000', opacity: 1 }
  }

  if (theme === 'transparent_white') {
    return { background: 'transparent', border: 'transparent', borderWidth: 0, text: '#FFFFFF', opacity: 1 }
  }

  if (theme === 'black') {
    return { background: '#000000', border: '#000000', borderWidth: 1, text: '#FFFFFF', opacity: 1 }
  }

  if (theme === 'white_border') {
    return { background: '#FFFFFF', border: '#000000', borderWidth: 1, text: '#000000', opacity: 1 }
  }

  if (theme === 'classic') {
    return { background: '#FFFFFF', border: 'transparent', borderWidth: 0, text: '#000000', opacity: 0.85 }
  }

  return { background: '#FFFFFF', border: 'transparent', borderWidth: 0, text: '#000000', opacity: 1 }
}

export const DriverMarkerImage = memo(function DriverMarkerImage({ onImage }: DriverMarkerImageProps) {
  const { location_driver, location_driver_time_text, globalFontSize, theme } = useDriverMarkerLogic()
  const svgRef = useRef<React.ElementRef<typeof Svg>>(null)
  const capturedSignatureRef = useRef<string | null>(null)

  const markerHeight = getMarkerHeight(globalFontSize)
  const markerFontSize = Math.max(globalFontSize, DRIVER_TIME_MIN_FONT_SIZE)
  const signature = location_driver
    ? getMarkerSignature(
        location_driver.lat,
        location_driver.lon,
        location_driver_time_text,
        globalFontSize,
        theme,
      )
    : ''
  const palette = useMemo(() => getMarkerPalette(theme), [theme])

  const captureMarker = useCallback(() => {
    if (!signature || capturedSignatureRef.current === signature) return

    const captureSignature = signature
    capturedSignatureRef.current = captureSignature
    svgRef.current?.toDataURL(
      (base64) => {
        if (captureSignature !== signature || !base64) return

        onImage({
          signature: captureSignature,
          source: { uri: `data:image/png;base64,${base64}` },
        })
      },
      getDriverMarkerCaptureSize(markerHeight),
    )
  }, [markerHeight, onImage, signature])

  if (!location_driver) return null

  const iconTop = (markerHeight - DRIVER_ICON_SIZE) / 2
  const textBaseline = markerHeight / 2 + markerFontSize * 0.35

  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: DRIVER_MARKER_WIDTH,
        height: markerHeight,
      }}
      testID="orders-map-driver-marker-source"
    >
      <Svg
        key={signature}
        ref={svgRef}
        width={DRIVER_MARKER_WIDTH}
        height={markerHeight}
        viewBox={`0 0 ${DRIVER_MARKER_WIDTH} ${markerHeight}`}
        onLayout={captureMarker}
      >
        <Rect
          x={DRIVER_TEXT_LEFT - 3}
          y={2}
          width={DRIVER_MARKER_WIDTH - DRIVER_TEXT_LEFT + 1}
          height={markerHeight - 4}
          rx={6}
          fill={palette.background}
          fillOpacity={palette.opacity}
          stroke={palette.border}
          strokeWidth={palette.borderWidth}
        />
        <G
          transform={`translate(2 ${iconTop}) scale(${DRIVER_ICON_SIZE / truckViewBoxWidth} ${DRIVER_ICON_SIZE / truckViewBoxHeight})`}
        >
          <Path d={truckPath} fill="#FF0000" />
        </G>
        <SvgText
          x={DRIVER_TEXT_LEFT + 5}
          y={textBaseline}
          fill={palette.text}
          fontFamily="Roboto-Regular"
          fontSize={markerFontSize}
          fontWeight="400"
        >
          {location_driver_time_text}
        </SvgText>
      </Svg>
    </View>
  )
})

export const DriverMarker = memo(function DriverMarker({ image }: DriverMarkerProps) {
  const { location_driver, location_driver_time_text, globalFontSize, mapScale, theme } = useDriverMarkerLogic()

  if (!location_driver) return null

  const signature = getMarkerSignature(
    location_driver.lat,
    location_driver.lon,
    location_driver_time_text,
    globalFontSize,
    theme,
  )

  const hasCapturedImage = image?.signature === signature
  const source = hasCapturedImage ? image.source : DRIVER_MARKER_FALLBACK
  const markerScale = getDriverMarkerNativeScale(mapScale, hasCapturedImage)

  return (
    <Marker
      point={location_driver}
      anchor={{ x: 0.03, y: 0.8 }}
      scale={markerScale}
      source={source}
    />
  )
})
