import React, {memo} from 'react';
import {PixelRatio, Platform} from 'react-native';
import {faDotCircle, faMapMarkerAlt} from '@fortawesome/free-solid-svg-icons';
import {Marker} from 'react-native-yamap-plus';
import {useAppTheme} from '@/shared/theme/AppThemeProvider';
import type {MapPointProps} from '../model/types';
import {MeasuredMarkerImage, type MarkerBitmap} from './MeasuredMarkerImage';

const FALLBACK_SOURCE = {
  uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAABuElEQVR4nO2bP5KDIBSHc6GtcwYvsq1XsM/WKb2IrXewtra1ZgOzOLMSFfnzeJCfzHxNJlG+iM8HPG/Nz/OGBHsHLuHChe+SWtJKeskomSVCM+vPev2dWv+mKOFKd36S/Hoy6WNUOQurqzMESO4x6GNnI/zd/A3L2KImoz4Xm/CXpEsgatLpcycVVv+0YJBdEL5X20f2wShq8qAWbjOQNGmphHOUdZYucRgHDe+zAYpb5izWQGaTVeGfMxq7IhrLI8smzPGcDaXzFS5pKJvsDu0j4RTpIhWjq3CdQadD2Zxw7AlTzHpSM5wVrqg6sdcIpd/m00kyqrONQPgtA9sSDlmp8BIlFJ9swnduWQLp1RoZWXTOSHgVrUnu31gtkvDqPjaF+w8U7o+Eg7Or2C2C8CrrMoXnDxSej4SDp4IZCotLGHlIwwUtuMcSXOIBl1rCTR7gpoeQCwBwSzwKqEW8qNGaEadl2ihZFyPOC/EKuK0WBdRmmgJuu7S0oR28Ib4AVfJAloFFJHpRS87SZGVLOQ5v8sK0/4EMpvRwAaq41LzaEOXDJjAF4iYwrwBsAfGSR9awd+ASJuYF2PmNUIhE8dsAAAAASUVORK5CYII=',
};
const FALLBACK_ANCHOR = {x: 0.5, y: 0.5};

const CLASSIC_PATH =
  'M91.2 1.9C41.4 1.9 1 42.3 1 92.1s40.4 90.2 90.2 90.2 5.9-.1 8.8-.4c-6.9 24.7-26.5 94.8-27.4 97.5-1 3.3 3.3 5.6 5.9 2.6s26.7-28.5 44.9-55.5c31.6-46.7 46-78.2 46-78.2 11.9-21.2 11.9-45.1 11.9-56.2 0-49.8-40.4-90.2-90.2-90.2zm0 157c-36.9 0-66.8-29.9-66.8-66.8s29.9-66.8 66.8-66.8S158 55.2 158 92.1s-29.9 66.8-66.8 66.8m0-101.8c-19.3 0-35 15.7-35 35s15.7 35 35 35 35-15.7 35-35-15.7-35-35-35';

// The classic SVG pin leans left; its tip is not at the bottom centre.
const CLASSIC_ANCHOR = {x: 75.66 / 183, y: 283.39 / 285};

export function getOrderMarkerSignature(
  {item, theme, globalFontSize}: MapPointProps,
  isDark: boolean,
): string {
  return JSON.stringify([
    item.point_text,
    item.point_color || item.color || 'blue',
    Boolean(item.close_time_),
    theme,
    globalFontSize,
    isDark,
  ]);
}

export const OrderMarkerImage = memo(function OrderMarkerImage(
  props: MapPointProps & {onImage: (image: MarkerBitmap) => void},
) {
  const {item, theme, globalFontSize, onImage} = props;
  const {isDark} = useAppTheme();
  const [viewBoxWidth, viewBoxHeight, , , path] = (
    !item.close_time_ ? faDotCircle : faMapMarkerAlt
  ).icon;
  const classic = theme === 'classic';
  return (
    <MeasuredMarkerImage
      signature={getOrderMarkerSignature(props, isDark)}
      text={String(item.point_text ?? '')}
      fontSize={globalFontSize}
      theme={theme}
      isDark={isDark}
      icon={{
        path: classic ? CLASSIC_PATH : Array.isArray(path) ? path[0] : path,
        viewBoxWidth: classic ? 183 : viewBoxWidth,
        viewBoxHeight: classic ? 285 : viewBoxHeight,
        width: 20,
        height: classic ? 28 : 20,
        color: item.point_color || item.color || 'blue',
        anchor: classic
          ? CLASSIC_ANCHOR
          : {x: 0.5, y: item.close_time_ ? 1 : 0.5},
      }}
      testID={`order-marker-image-${item.id}`}
      onImage={onImage}
    />
  );
});

export function getOrderMarkerNativeScale(
  mapScale: number,
  hasImage: boolean,
  platformOS = Platform.OS,
  density = PixelRatio.get(),
): number {
  return hasImage
    ? mapScale
    : mapScale * (20 / 60) * (platformOS === 'android' ? density : 1);
}

export const OrderMarker = memo(function OrderMarker({
  item,
  mapScale,
  showOrdersMap,
  image,
}: MapPointProps & {image?: MarkerBitmap}) {
  return (
    <Marker
      handled
      strictTapBounds
      point={item.xy}
      anchor={image?.anchor ?? FALLBACK_ANCHOR}
      scale={getOrderMarkerNativeScale(mapScale, Boolean(image))}
      source={image?.source ?? FALLBACK_SOURCE}
      visible
      onPress={() => showOrdersMap(item.id)}
      testID={`order-marker-${item.id}`}
    />
  );
});
