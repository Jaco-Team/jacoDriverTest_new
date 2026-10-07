import React, {memo} from 'react';
import {faHouse} from '@fortawesome/free-solid-svg-icons';
import {Marker} from 'react-native-yamap-plus';
import type {MapPointHouse} from '../model/types';
import {MeasuredMarkerImage, type MarkerBitmap} from './MeasuredMarkerImage';

const [viewBoxWidth, viewBoxHeight, , , path] = faHouse.icon;

export const HomeMarkerImage = memo(function HomeMarkerImage({
  isDark,
  onImage,
}: {
  isDark: boolean;
  onImage: (image: MarkerBitmap) => void;
}) {
  return (
    <MeasuredMarkerImage
      signature={`home:${isDark}`}
      text=""
      fontSize={16}
      theme="transparent"
      isDark={isDark}
      icon={{
        path: Array.isArray(path) ? path[0] : path,
        viewBoxWidth,
        viewBoxHeight,
        width: 20,
        height: 20,
        color: isDark ? '#FFFFFF' : '#000000',
      }}
      testID="orders-map-home-image"
      onImage={onImage}
    />
  );
});

export const HomeMarker = memo(function HomeMarker({
  point,
  getHome,
  isDark,
  image,
  refreshKey,
}: MapPointHouse & {
  isDark: boolean;
  image?: MarkerBitmap | null;
  refreshKey?: string;
}) {
  const expectedSignature = `home:${isDark}`;
  const currentImage =
    image?.signature === expectedSignature ? image : null;

  return (
    <Marker
      key={`${refreshKey ?? 'initial'}:${expectedSignature}`}
      handled
      strictTapBounds
      point={point}
      onPress={getHome}
      scale={1}
      source={currentImage?.source}
      anchor={currentImage?.anchor}
      visible={Boolean(currentImage)}
      testID="orders-map-home-marker"
    />
  );
});
