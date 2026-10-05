import React, {memo, useRef} from 'react';
import {PixelRatio, Platform, type ImageSourcePropType} from 'react-native';
import {MeasuredMarkerImage, type MarkerBitmap} from './MeasuredMarkerImage';
export {getMarkerPalette} from './MeasuredMarkerImage';

import {faTruckFast} from '@fortawesome/free-solid-svg-icons';
import {Marker} from 'react-native-yamap-plus';

import type {Theme} from '@/shared/types/globalTypes';
import {useAppTheme} from '@/shared/theme/AppThemeProvider';

import {useDriverMarkerLogic} from '../model/useDriverMarkerLogic';
import {isValidMapPoint} from '../model/mapPoint';

const DRIVER_ICON_SIZE = 24;
const DRIVER_TIME_MIN_FONT_SIZE = 16;
const DRIVER_FALLBACK_WIDTH = 80;
// Keep the native map child mounted at a stable index. Adding/removing Marker
// after YaMap has mounted corrupts its Fabric child order on Android.
const DRIVER_MARKER_PLACEHOLDER_POINT = {lat: 0, lon: 0};
const DRIVER_MARKER_FALLBACK: ImageSourcePropType = {
  uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABACAMAAAC6GQAEAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAABgUExURQAAAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAAAAAMWCKEYAAAAedFJOUwAANZHgKEMBs/GwUwZbkgyulA45DwQXrK0dHlx3eaDxh6AAAAABYktHRACIBR1IAAAAB3RJTUUH6ggfDRMgEVhsRQAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyNi0wOC0zMVQxMzoxOTozMiswMDowMI5whJoAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjYtMDgtMzFUMTM6MTk6MzIrMDA6MDD/LTwmAAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDI2LTA4LTMxVDEzOjE5OjMyKzAwOjAwqDgd+QAAAWJJREFUWMPtmOcOgzAMhEsp0AUddI+8/2N2RWAHk8SJ1UoV9zO6fr3EOMiMRoNkNU4nykeTdOyDy/xompk5eTkD91LuysfkKWXPWHD2q3ddWOvB5illrUwaAExtQP6On3umizENQGnJFNcBjMhHA2N48gk/ms0XS6EzbFXKVBmosrbNW6s1i7hxE7e8jG5iwty1k8hM6CQyz7AhClX5oyoR6OViA1ZKiV5GRJFehkSZ2wYQhe7Dlih1YxfdpZDnj7hX4zrEE+jfwz9KGHuGor0c+xxSQNl8sb38lYTiZyheZfM5GoD/DOxMAfVzsbb+lnQ0QHNO2b1XdxYe7WiAxiRV6+X+jD2O9rWF97zXy/teIO0AsxBu6sT5fqEdcEJF83JgQjxDw4k+6Ay7Uz745sCuct93iANM0Pz7geXAOhJhTkwH0pmwX5gOrLLjvrIdWDfDfQ9w2BJcgxzGObbnfjzzHA8O1Zd9slg9hAAAAABJRU5ErkJggg==',
};
const [truckViewBoxWidth, truckViewBoxHeight, , , truckPathData] =
  faTruckFast.icon;
const truckPath = Array.isArray(truckPathData)
  ? truckPathData[0]
  : truckPathData;

export type DriverMarkerImageSource = MarkerBitmap;

interface DriverMarkerImageProps {
  onImage: (image: DriverMarkerImageSource) => void;
}

interface DriverMarkerProps {
  image: DriverMarkerImageSource | null;
}

function getMarkerHeight(globalFontSize: number): number {
  const fontSize = Math.max(globalFontSize, DRIVER_TIME_MIN_FONT_SIZE);
  return Math.max(DRIVER_ICON_SIZE + 8, Math.ceil(fontSize + 16));
}

export function getDriverMarkerNativeScale(
  mapScale: number,
  hasCapturedImage: boolean,
  platformOS = Platform.OS,
  pixelRatio = PixelRatio.get(),
): number {
  if (hasCapturedImage) return mapScale;

  const densityScale = platformOS === 'android' ? pixelRatio : 1;
  return mapScale * densityScale * (DRIVER_ICON_SIZE / DRIVER_FALLBACK_WIDTH);
}

function getMarkerSignature(
  lat: number,
  lon: number,
  timeText: string,
  globalFontSize: number,
  theme: Theme,
  isDark: boolean,
): string {
  return `${lat}:${lon}:${timeText}:${globalFontSize}:${theme}:${isDark ? 'dark' : 'light'}`;
}

export const DriverMarkerImage = memo(function DriverMarkerImage({
  onImage,
}: DriverMarkerImageProps) {
  const {location_driver, location_driver_time_text, globalFontSize, theme} =
    useDriverMarkerLogic();
  const {isDark} = useAppTheme();
  if (!isValidMapPoint(location_driver)) return null;
  return (
    <MeasuredMarkerImage
      signature={getMarkerSignature(
        location_driver.lat,
        location_driver.lon,
        location_driver_time_text,
        globalFontSize,
        theme,
        isDark,
      )}
      text={location_driver_time_text}
      fontSize={Math.max(globalFontSize, DRIVER_TIME_MIN_FONT_SIZE)}
      theme={theme}
      isDark={isDark}
      icon={{
        path: truckPath,
        viewBoxWidth: truckViewBoxWidth,
        viewBoxHeight: truckViewBoxHeight,
        width: DRIVER_ICON_SIZE,
        height: DRIVER_ICON_SIZE,
        color: '#FF0000',
      }}
      minHeight={getMarkerHeight(globalFontSize)}
      testID="orders-map-driver-marker-source"
      onImage={onImage}
    />
  );
});

export const DriverMarker = memo(function DriverMarker({
  image,
}: DriverMarkerProps) {
  const {
    location_driver,
    location_driver_time_text,
    globalFontSize,
    mapScale,
    theme,
  } = useDriverMarkerLogic();
  const {isDark} = useAppTheme();
  const lastVisibleMarkerRef = useRef<{
    point: NonNullable<typeof location_driver>;
    timeText: string;
  } | null>(null);

  const hasValidLocation = isValidMapPoint(location_driver);

  if (hasValidLocation) {
    lastVisibleMarkerRef.current = {
      point: location_driver,
      timeText: location_driver_time_text,
    };
  }

  const markerState = lastVisibleMarkerRef.current;
  const point = markerState?.point ?? DRIVER_MARKER_PLACEHOLDER_POINT;
  const signature = markerState
    ? getMarkerSignature(
        markerState.point.lat,
        markerState.point.lon,
        markerState.timeText,
        globalFontSize,
        theme,
        isDark,
      )
    : '';

  const hasCapturedImage = image?.signature === signature;
  const source = hasCapturedImage ? image.source : DRIVER_MARKER_FALLBACK;
  const markerScale = getDriverMarkerNativeScale(mapScale, hasCapturedImage);

  return (
    <Marker
      point={point}
      anchor={hasCapturedImage ? image.anchor : {x: 0.5, y: 0.5}}
      scale={markerScale}
      source={source}
      visible={hasValidLocation}
    />
  );
});
