import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PixelRatio,
  Platform,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Svg, {G, Path, Rect, Text as SvgText} from 'react-native-svg';
import type {Theme} from '@/shared/types/globalTypes';

export interface MarkerBitmap {
  signature: string;
  source: ImageSourcePropType;
  width: number;
  height: number;
  anchor: {x: number; y: number};
}

export interface MarkerIcon {
  path: string;
  viewBoxWidth: number;
  viewBoxHeight: number;
  width: number;
  height: number;
  color: string;
  anchor?: {x: number; y: number};
}

export function getMarkerIconLayout(icon: MarkerIcon) {
  const scale = Math.min(
    icon.width / icon.viewBoxWidth,
    icon.height / icon.viewBoxHeight,
  );
  const width = icon.viewBoxWidth * scale;
  const height = icon.viewBoxHeight * scale;

  return {
    scale,
    width,
    height,
    offsetX: (icon.width - width) / 2,
    offsetY: (icon.height - height) / 2,
  };
}

export function getMarkerAnchor(
  width: number,
  height: number,
  icon: MarkerIcon,
) {
  const anchor = icon.anchor ?? {x: 0.5, y: 0.5};
  const layout = getMarkerIconLayout(icon);
  return {
    x: (layout.offsetX + layout.width * anchor.x) / width,
    y:
      ((height - icon.height) / 2 +
        layout.offsetY +
        layout.height * anchor.y) /
      height,
  };
}

export function getMarkerPalette(theme: Theme, isDark: boolean) {
  if (theme === 'transparent' || theme === 'transparent_white') {
    return {
      background: 'transparent',
      border: 'transparent',
      borderWidth: 0,
      text: isDark ? '#FFFFFF' : '#000000',
      opacity: 1,
    };
  }
  if (theme === 'black')
    return {
      background: '#000000',
      border: '#000000',
      borderWidth: 1,
      text: '#FFFFFF',
      opacity: 1,
    };
  if (theme === 'white_border')
    return {
      background: '#FFFFFF',
      border: '#000000',
      borderWidth: 1,
      text: '#000000',
      opacity: 1,
    };
  return {
    background: '#FFFFFF',
    border: 'transparent',
    borderWidth: 0,
    text: '#000000',
    opacity: theme === 'classic' ? 0.85 : 1,
  };
}

export function getMarkerCaptureSize(
  width: number,
  height: number,
  platformOS = Platform.OS,
  density = PixelRatio.get(),
) {
  const ratio = platformOS === 'android' ? density : 1;
  return {width: Math.ceil(width * ratio), height: Math.ceil(height * ratio)};
}

interface Props {
  signature: string;
  text: string;
  fontSize: number;
  theme: Theme;
  isDark: boolean;
  icon: MarkerIcon;
  minHeight?: number;
  testID: string;
  onImage: (image: MarkerBitmap) => void;
}

// Render outside YaMap: MapKit's deprecated child snapshots can be taken before
// Fabric has finished laying out the text. Measure first, then export the SVG.
export const MeasuredMarkerImage = memo(function MeasuredMarkerImage({
  signature,
  text,
  fontSize,
  theme,
  isDark,
  icon,
  minHeight = 0,
  testID,
  onImage,
}: Props) {
  const svgRef = useRef<React.ElementRef<typeof Svg>>(null);
  const captured = useRef('');
  const requestId = useRef(0);
  const pending = useRef(false);
  const attempts = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureLatest = useRef<() => void>(() => undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const measurementKey = JSON.stringify([text, fontSize]);
  const latestMeasurementKey = useRef(measurementKey);
  latestMeasurementKey.current = measurementKey;
  const [measurement, setMeasurement] = useState<{
    key: string;
    width: number;
    height: number;
    baseline: number;
  } | null>(null);
  const hasText = text.length > 0;
  const measured = useMemo(
    () =>
      !hasText
        ? {key: measurementKey, width: 0, height: 0, baseline: 0}
        : measurement?.key === measurementKey
          ? measurement
          : null,
    [hasText, measurement, measurementKey],
  );
  const palette = getMarkerPalette(theme, isDark);
  const gap = !hasText || theme === 'classic' ? 0 : 4;
  const labelWidth =
    hasText && measured
      ? Math.ceil(measured.width) + 16 + 2 * palette.borderWidth
      : 0;
  const height = Math.ceil(
    Math.max(
      icon.height,
      minHeight,
      hasText ? (measured?.height ?? 0) + 8 + 2 * palette.borderWidth : 0,
    ),
  );
  const width = icon.width + gap + labelWidth;
  const iconLayout = getMarkerIconLayout(icon);
  const captureKey = `${signature}:${width}:${height}`;
  const latestCaptureKey = useRef(captureKey);
  latestCaptureKey.current = captureKey;

  const anchor = useMemo(
    () => getMarkerAnchor(width, height, icon),
    [width, height, icon],
  );
  const ready = Boolean(measured);
  const capture = useCallback(() => {
    if (
      !ready ||
      !svgRef.current ||
      captured.current === captureKey ||
      pending.current ||
      attempts.current >= 3
    )
      return;
    pending.current = true;
    attempts.current += 1;
    const id = ++requestId.current;
    const isCurrent = () =>
      mounted.current &&
      latestCaptureKey.current === captureKey &&
      requestId.current === id;
    const retry = () => {
      if (!isCurrent()) return;
      pending.current = false;
      captureLatest.current();
    };
    // Some native exports never call back (e.g. the Fabric view is not ready).
    retryTimer.current = setTimeout(retry, 500);
    const failed = () => {
      if (!isCurrent()) return;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(retry, 100);
    };
    try {
      svgRef.current.toDataURL(
        base64 => {
          if (!isCurrent()) return;
          const data = base64?.replace(/\s/g, '');
          if (!data) {
            failed();
            return;
          }
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = null;
          pending.current = false;
          captured.current = captureKey;
          onImage({
            signature,
            source: {uri: `data:image/png;base64,${data}`},
            width,
            height,
            anchor,
          });
        },
        getMarkerCaptureSize(width, height),
      );
    } catch {
      failed();
    }
  }, [anchor, captureKey, height, onImage, ready, signature, width]);
  captureLatest.current = capture;

  useEffect(() => {
    pending.current = false;
    attempts.current = 0;
    // Export after Fabric commits the SVG bounds, even if onLayout was lost.
    const initial = ready
      ? setTimeout(() => captureLatest.current(), 50)
      : null;
    return () => {
      if (initial) clearTimeout(initial);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = null;
      pending.current = false;
      requestId.current += 1;
    };
  }, [captureKey, ready]);

  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={{position: 'absolute', left: -10000, top: 0}}
      testID={testID}>
      {hasText ? (
        <Text
          key={measurementKey}
          testID={`${testID}-measure`}
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            position: 'absolute',
            width: 8192,
            fontFamily: 'Roboto-Regular',
            fontSize,
            fontWeight: '400',
          }}
          onTextLayout={event => {
            const line = event.nativeEvent.lines[0];
            if (
              line &&
              latestMeasurementKey.current === measurementKey &&
              Number.isFinite(line.width) &&
              Number.isFinite(line.height) &&
              line.width >= 0 &&
              line.height > 0
            ) {
              setMeasurement({
                key: measurementKey,
                width: line.width,
                height: line.height,
                baseline: Number.isFinite(line.ascender)
                  ? line.ascender
                  : fontSize * 0.8,
              });
            }
          }}>
          {text}
        </Text>
      ) : null}
      {measured ? (
        <Svg
          key={captureKey}
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          testID={`${testID}-svg`}>
          {hasText ? (
            <Rect
              x={icon.width + gap + palette.borderWidth / 2}
              y={palette.borderWidth / 2}
              width={labelWidth - palette.borderWidth}
              height={height - palette.borderWidth}
              rx={6}
              fill={palette.background}
              fillOpacity={palette.opacity}
              stroke={palette.border}
              strokeWidth={palette.borderWidth}
            />
          ) : null}
          <G
            transform={`translate(${iconLayout.offsetX} ${(height - icon.height) / 2 + iconLayout.offsetY}) scale(${iconLayout.scale})`}>
            <Path d={icon.path} fill={icon.color} />
          </G>
          {hasText ? (
            <SvgText
              x={icon.width + gap + 8 + palette.borderWidth}
              y={(height - measured.height) / 2 + measured.baseline}
              fill={palette.text}
              fontFamily="Roboto-Regular"
              fontSize={fontSize}
              fontWeight="400">
              {text}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
});
