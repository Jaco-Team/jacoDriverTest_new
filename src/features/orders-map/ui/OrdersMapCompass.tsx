import React, {memo, useMemo} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useShallow} from 'zustand/react/shallow';
import {useOrdersStore, useGlobalStore} from '@/shared/store/store';
import {useAppTheme} from '@/shared/theme/AppThemeProvider';
import {
  getMapEdgeIndicators,
  type MapViewport,
  type OrderMapGroup,
} from '../model/mapEdgeIndicators';

const DIRECTIONS = [
  'север',
  'северо-восток',
  'восток',
  'юго-восток',
  'юг',
  'юго-запад',
  'запад',
  'северо-запад',
];

function getOrderCountLabel(count: number): string {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} заказов`;
  if (lastDigit === 1) return `${count} заказ`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} заказа`;
  return `${count} заказов`;
}

export const OrdersMapCompass = memo(function OrdersMapCompass({
  viewport,
  onCenter,
}: {
  viewport: MapViewport | null;
  onCenter: (target: OrderMapGroup) => void;
}) {
  const {orders, preferDriverColor} = useOrdersStore(
    useShallow(state => ({
      orders: state.orders,
      preferDriverColor: state.type.id === 5,
    })),
  );
  const globalFontSize = useGlobalStore(state => state.globalFontSize);
  const {colors} = useAppTheme();
  const indicators = useMemo(
    () => getMapEdgeIndicators(orders, viewport, preferDriverColor),
    [orders, preferDriverColor, viewport],
  );
  const countFontSize = Math.min(18, Math.max(12, globalFontSize - 2));

  if (indicators.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={styles.container}
      testID="orders-map-compass">
      {indicators.map(indicator => (
        <TouchableOpacity
          accessibilityLabel={`Показать ${getOrderCountLabel(indicator.count)}, направление ${DIRECTIONS[indicator.sector]}`}
          accessibilityRole="button"
          activeOpacity={0.8}
          key={indicator.sector}
          onPress={() => onCenter(indicator)}
          style={[
            styles.indicator,
            {
              left: `${indicator.left}%`,
              top: `${indicator.top}%`,
              borderColor: colors.border,
              backgroundColor: colors.surfaceRaised,
              shadowColor: colors.shadowStrong,
            },
          ]}
          testID={`orders-map-edge-indicator-${indicator.sector}`}>
          <View
            pointerEvents="none"
            style={[
              styles.arrowLayer,
              {transform: [{rotate: `${indicator.angle}deg`}]},
            ]}>
            <View style={[styles.arrow, {borderBottomColor: colors.brand}]} />
          </View>

          <Text
            style={[
              styles.count,
              {color: colors.text, fontSize: countFontSize},
            ]}>
            {indicator.count}
          </Text>

          <View pointerEvents="none" style={styles.statuses}>
            {indicator.statusColors.slice(0, 3).map(color => (
              <View
                key={color}
                style={[
                  styles.status,
                  {backgroundColor: color, borderColor: colors.surfaceRaised},
                ]}
              />
            ))}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 80,
    top: 78,
    right: 62,
    bottom: 140,
    left: 10,
  },
  indicator: {
    position: 'absolute',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 22,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 5,
  },
  arrowLayer: {
    position: 'absolute',
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    alignItems: 'center',
  },
  arrow: {
    width: 0,
    height: 0,
    borderRightWidth: 6,
    borderRightColor: 'transparent',
    borderBottomWidth: 10,
    borderLeftWidth: 6,
    borderLeftColor: 'transparent',
  },
  count: {
    marginTop: 4,
    fontFamily: 'Roboto-Bold',
    lineHeight: 18,
  },
  statuses: {
    position: 'absolute',
    right: 8,
    bottom: 5,
    left: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
  },
  status: {
    width: 6,
    height: 6,
    borderWidth: 1,
    borderRadius: 3,
  },
});
