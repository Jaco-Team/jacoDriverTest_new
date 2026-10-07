import React, {useMemo} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {WifiOff} from 'lucide-react-native';
import {useShallow} from 'zustand/react/shallow';

import {useAppTheme} from '@/shared/theme/AppThemeProvider';
import {useGlobalStore, useOrdersStore} from '@/shared/store/store';
import {groupOrdersByMapLocation} from '../model/mapEdgeIndicators';

function clampFontSize(value: number, min: number, max: number): number {
  return Math.max(Math.min(value, max), min);
}

function getOrderCountLabel(count: number): string {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} заказов`;
  if (lastDigit === 1) return `${count} заказ`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} заказа`;
  return `${count} заказов`;
}

export function OrdersMapOfflineList({topInset}: {topInset: number}) {
  const {colors} = useAppTheme();
  const {orders, type, showOrdersMap} = useOrdersStore(
    useShallow(state => ({
      orders: state.orders,
      type: state.type,
      showOrdersMap: state.showOrdersMap,
    })),
  );
  const globalFontSize = useGlobalStore(state => state.globalFontSize);
  const groups = useMemo(
    () => groupOrdersByMapLocation(orders, type.id === 5),
    [orders, type.id],
  );
  const titleFontSize = clampFontSize(globalFontSize + 4, 20, 28);
  const hintFontSize = clampFontSize(globalFontSize - 1, 13, 16);
  const addressFontSize = clampFontSize(globalFontSize, 14, 20);
  const metaFontSize = clampFontSize(globalFontSize - 2, 12, 15);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {paddingTop: topInset + 16, backgroundColor: colors.surface},
      ]}
      testID="orders-map-offline-list">
      <View
        style={[
          styles.notice,
          {
            borderColor: colors.border,
            backgroundColor: colors.surfaceRaised,
            shadowColor: colors.shadowStrong,
          },
        ]}>
        <View style={[styles.noticeIcon, {backgroundColor: colors.softStrong}]}>
          <WifiOff color={colors.primary} size={24} />
        </View>
        <View style={styles.noticeText}>
          <Text
            style={{
              color: colors.text,
              fontFamily: 'Roboto-Bold',
              fontSize: titleFontSize,
              lineHeight: titleFontSize * 1.2,
            }}>
            Карта недоступна
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: hintFontSize,
              lineHeight: hintFontSize * 1.4,
            }}>
            Карта этой области ещё не сохранена. Скачайте город в настройках при
            подключённом интернете.
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: hintFontSize,
              lineHeight: hintFontSize * 1.4,
            }}>
            Заказы «{type.text}» доступны из сохранённого списка.
          </Text>
        </View>
      </View>

      {groups.length === 0 ? (
        <Text
          style={[
            styles.empty,
            {color: colors.textMuted, fontSize: addressFontSize},
          ]}>
          Сохранённых заказов нет.
        </Text>
      ) : (
        <View style={styles.list}>
          {groups.map(group => {
            const order = group.representative;
            const meta = [
              order.id_text || `#${order.id}`,
              order.status,
              order.close_time_ ?? order.need_time,
            ]
              .filter(
                value =>
                  value !== null && value !== undefined && value !== '',
              )
              .join(' · ');

            return (
              <Pressable
                accessibilityRole="button"
                key={group.key}
                onPress={() => showOrdersMap(order.id)}
                style={[
                  styles.order,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceRaised,
                    shadowColor: colors.shadowStrong,
                  },
                ]}
                testID={`orders-map-offline-order-${order.id}`}>
                <View
                  style={[
                    styles.status,
                    {backgroundColor: group.statusColors[0]},
                  ]}
                />
                <View style={styles.orderText}>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: colors.text,
                      fontFamily: 'Roboto-Bold',
                      fontSize: addressFontSize,
                      lineHeight: addressFontSize * 1.3,
                    }}>
                    {order.addr || 'Адрес не указан'}
                  </Text>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: metaFontSize,
                      lineHeight: metaFontSize * 1.4,
                    }}>
                    {meta}
                  </Text>
                </View>
                {group.count > 1 ? (
                  <View
                    style={[
                      styles.count,
                      {backgroundColor: colors.softStrong},
                    ]}>
                    <Text
                      style={{
                        color: colors.primary,
                        fontFamily: 'Roboto-Bold',
                        fontSize: metaFontSize,
                      }}>
                      {getOrderCountLabel(group.count)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 170,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 24,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 2,
  },
  noticeIcon: {
    width: 46,
    height: 46,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  noticeText: {flex: 1, gap: 4},
  empty: {paddingHorizontal: 16, paddingVertical: 24, textAlign: 'center'},
  list: {gap: 10},
  order: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 20,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 2,
  },
  status: {width: 12, height: 12, flexShrink: 0, borderRadius: 6},
  orderText: {flex: 1, minWidth: 0},
  count: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
});
