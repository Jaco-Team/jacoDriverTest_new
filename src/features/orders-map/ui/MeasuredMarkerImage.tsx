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
import Svg, {Circle, G, Path, Rect, Text as SvgText} from 'react-native-svg';
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
  origin?: {x: number; y: number},
) {
  const anchor = icon.anchor ?? {x: 0.5, y: 0.5};
  const layout = getMarkerIconLayout(icon);
  const iconOrigin = origin ?? {
    x: 0,
    y: (height - icon.height) / 2,
  };
  return {
    x: (iconOrigin.x + layout.offsetX + layout.width * anchor.x) / width,
    y: (iconOrigin.y + layout.offsetY + layout.height * anchor.y) / height,
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
  groupCount?: number;
  statusColors?: string[];
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
  groupCount = 1,
  statusColors = [],
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
  const isGroup = groupCount > 1;
  const visualIconWidth = isGroup ? 26 : icon.width;
  const visualIconHeight = isGroup ? 26 : icon.height;
  const groupTopInset = 0;
  const groupBottomInset = isGroup ? 18 : 0;
  const gap = !hasText ? 0 : isGroup ? 7 : theme === 'classic' ? 0 : 4;
  const visibleStatusColors = statusColors.slice(0, 3);
  const hiddenStatusCount = Math.max(
    0,
    statusColors.length - visibleStatusColors.length,
  );
  const statusOverflowLabel =
    hiddenStatusCount > 0 ? `+${hiddenStatusCount}` : '';
  const statusDotsWidth =
    visibleStatusColors.length * 6 +
    Math.max(0, visibleStatusColors.length - 1) * 2;
  const statusOverflowGap =
    statusOverflowLabel && visibleStatusColors.length ? 2 : 0;
  const statusOverflowWidth = statusOverflowLabel
    ? statusOverflowLabel.length * 5
    : 0;
  const statusPillWidth = Math.max(
    14,
    statusDotsWidth + statusOverflowGap + statusOverflowWidth + 8,
  );
  // Keep antialiasing and the pill stroke inside the exported PNG bounds.
  // Without this inset, grouped markers touch x=0/the right edge and iOS
  // visibly clips both sides in the light theme.
  const groupSideInset = isGroup ? 2 : 0;
  const groupVisualWidth = isGroup
    ? Math.max(visualIconWidth, statusPillWidth)
    : visualIconWidth;
  const groupLeftInset = isGroup
    ? groupSideInset + (groupVisualWidth - visualIconWidth) / 2
    : 0;
  const statusPillLeft =
    groupLeftInset + visualIconWidth / 2 - statusPillWidth / 2;
  const labelWidth =
    hasText && measured
      ? Math.ceil(measured.width) + 16 + 2 * palette.borderWidth
      : 0;
  const contentHeight = Math.ceil(
    Math.max(
      visualIconHeight,
      minHeight,
      hasText ? (measured?.height ?? 0) + 8 + 2 * palette.borderWidth : 0,
    ),
  );
  const height = groupTopInset + contentHeight + groupBottomInset;
  const labelX = groupSideInset + groupVisualWidth + gap;
  const width = labelX + labelWidth + groupSideInset;
  const iconLayout = getMarkerIconLayout(icon);
  const captureKey = `${signature}:${width}:${height}`;
  const latestCaptureKey = useRef(captureKey);
  latestCaptureKey.current = captureKey;

  const anchor = useMemo(
    () =>
      isGroup
        ? {
            x: (groupLeftInset + visualIconWidth / 2) / width,
            y: (groupTopInset + contentHeight / 2) / height,
          }
        : getMarkerAnchor(width, height, icon, {
            x: groupLeftInset,
            y: groupTopInset + (contentHeight - icon.height) / 2,
          }),
    [
      contentHeight,
      groupLeftInset,
      groupTopInset,
      height,
      icon,
      isGroup,
      visualIconWidth,
      width,
    ],
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
              x={labelX + palette.borderWidth / 2}
              y={groupTopInset + palette.borderWidth / 2}
              width={labelWidth - palette.borderWidth}
              height={contentHeight - palette.borderWidth}
              rx={6}
              fill={palette.background}
              fillOpacity={palette.opacity}
              stroke={palette.border}
              strokeWidth={palette.borderWidth}
            />
          ) : null}
          {isGroup ? (
            <>
              <Circle
                cx={groupLeftInset + visualIconWidth / 2}
                cy={groupTopInset + contentHeight / 2 + 1.5}
                r={13}
                fill="#000000"
                fillOpacity={isDark ? 0.42 : 0.2}
                testID={`${testID}-group-count-shadow`}
              />
              <Circle
                cx={groupLeftInset + visualIconWidth / 2}
                cy={groupTopInset + contentHeight / 2}
                r={13}
                fill="#FFFFFF"
                testID={`${testID}-group-count-background`}
              />
              <Circle
                cx={groupLeftInset + visualIconWidth / 2}
                cy={groupTopInset + contentHeight / 2}
                r={11}
                fill={isDark ? '#D53656' : '#CC0033'}
              />
              <SvgText
                x={groupLeftInset + visualIconWidth / 2}
                y={groupTopInset + contentHeight / 2 + 4}
                fill="#FFFFFF"
                fontFamily="Roboto-Bold"
                fontSize={
                  groupCount > 99 ? 9 : Math.min(14, Math.max(12, fontSize - 4))
                }
                fontWeight="700"
                textAnchor="middle"
                testID={`${testID}-group-count`}>
                {groupCount > 99 ? '99+' : String(groupCount)}
              </SvgText>
            </>
          ) : (
            <G
              transform={`translate(${groupLeftInset + iconLayout.offsetX} ${groupTopInset + (contentHeight - icon.height) / 2 + iconLayout.offsetY}) scale(${iconLayout.scale})`}>
              <Path d={icon.path} fill={icon.color} />
            </G>
          )}
          {hasText ? (
            <SvgText
              x={labelX + 8 + palette.borderWidth}
              y={
                groupTopInset +
                (contentHeight - measured.height) / 2 +
                measured.baseline
              }
              fill={palette.text}
              fontFamily="Roboto-Regular"
              fontSize={fontSize}
              fontWeight="400">
              {text}
            </SvgText>
          ) : null}
          {isGroup ? (
            <>
              <Rect
                x={statusPillLeft}
                y={groupTopInset + contentHeight + 3}
                width={statusPillWidth}
                height={12}
                rx={6}
                fill={isDark ? '#161F28' : '#E9EEF3'}
                stroke={isDark ? '#66849D' : '#42627D'}
                strokeOpacity={0.72}
                strokeWidth={1}
                testID={`${testID}-group-statuses-background`}
              />
              {visibleStatusColors.map((color, index) => (
                <Circle
                  key={`${color}:${index}`}
                  cx={statusPillLeft + 4 + 3 + index * 8}
                  cy={groupTopInset + contentHeight + 9}
                  r={3}
                  fill={color}
                  stroke={isDark ? '#F2F5F7' : '#FFFFFF'}
                  strokeWidth={0.75}
                />
              ))}
              {statusOverflowLabel ? (
                <SvgText
                  x={
                    statusPillLeft +
                    4 +
                    statusDotsWidth +
                    statusOverflowGap +
                    statusOverflowWidth / 2
                  }
                  y={groupTopInset + contentHeight + 12}
                  fill={isDark ? '#F2F5F7' : '#42627D'}
                  fontFamily="Roboto-Bold"
                  fontSize={8}
                  fontWeight="700"
                  textAnchor="middle"
                  testID={`${testID}-group-statuses-overflow`}>
                  {statusOverflowLabel}
                </SvgText>
              ) : null}
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
});
