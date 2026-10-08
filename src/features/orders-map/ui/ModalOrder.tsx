import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronLeft} from 'lucide-react-native';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import {
  CardOrder,
  ORDER_CARD_DELETED_BG,
} from '@/entities/CardOrder/ui/CardOrder';
import {getOrderAddress} from '@/entities/CardOrder/model/getOrderAddress';
import {toOrderInt} from '@/entities/CardOrder/model/normalizeOrderValue';
import {appPalette} from '@/shared/styles/appPalette';
import type {Order} from '@/shared/store/OrdersStoreType';

import {getOrderUrgency} from '../model/mapEdgeIndicators';
import {useModalOrderLogic} from '../model/useModalOrderLogic';
import {useAppTheme} from '@/shared/theme/AppThemeProvider';

export const ModalOrder = (): React.JSX.Element | null => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useAppTheme();
  const groupBorderColor = isDark
    ? 'rgba(126, 155, 179, 0.42)'
    : 'rgba(66, 98, 125, 0.28)';
  const {
    FormatPrice,
    globalFontSize,
    showAlertText,
    showOrders,
    isOpenOrderMap,
    showOrdersMap,
    actionButtonOrder,
    setActiveConfirm,
    dialCall,
    isBusy,
    mapOrderSession,
  } = useModalOrderLogic();
  const [selection, setSelection] = useState<{
    session: number;
    orderId: number | null;
  }>({session: mapOrderSession, orderId: null});
  const selectedOrderId =
    selection.session === mapOrderSession ? selection.orderId : null;
  const isGroup = showOrders.length > 1;
  const selectedOrder = useMemo(
    () => showOrders.find(item => item.id === selectedOrderId) ?? null,
    [selectedOrderId, showOrders],
  );

  const isDeleted =
    showOrders.length > 0 &&
    showOrders.every(item => toOrderInt(item.is_delete) === 1);
  const sheetBackground = isDeleted
    ? ORDER_CARD_DELETED_BG
    : colors.surfaceRaised;

  function close(): void {
    if (!isBusy) showOrdersMap(-1, mapOrderSession);
  }

  // Unmount the overlay immediately; a cancelled exit animation must not
  // leave an invisible touch interceptor over the map. Sessions also isolate
  // rapid close/open updates that React batches into one render.
  if (!isOpenOrderMap) return null;

  return (
    <Actionsheet key={mapOrderSession} isOpen={isOpenOrderMap} onClose={close}>
      <ActionsheetBackdrop testID="order-map-backdrop" />
      <ActionsheetContent
        style={[
          styles.sheet,
          {borderColor: colors.border, backgroundColor: sheetBackground},
        ]}
        testID="order-map-sheet">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator style={styles.handleArea}>
            <Pressable
              accessibilityLabel="Закрыть карточку заказа"
              accessibilityRole="button"
              disabled={isBusy}
              style={styles.handlePressable}
              testID="order-map-sheet-handle"
              onPress={close}>
              <View
                style={[
                  styles.handle,
                  !isDeleted && {backgroundColor: colors.border},
                  isDeleted ? styles.handleDeleted : null,
                ]}
              />
            </Pressable>
          </ActionsheetDragIndicator>
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView
          contentContainerStyle={{paddingBottom: insets.bottom + 14}}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          testID="order-map-sheet-scroll">
          {isGroup && !selectedOrder ? (
            <OrderGroupList
              globalFontSize={globalFontSize}
              orders={showOrders}
              onSelect={orderId =>
                setSelection({session: mapOrderSession, orderId})
              }
            />
          ) : null}

          {isGroup && selectedOrder ? (
            <TouchableOpacity
              accessibilityLabel={`Показать все заказы по адресу, ${showOrders.length}`}
              accessibilityRole="button"
              activeOpacity={0.72}
              style={[
                styles.backButton,
                {
                  borderColor: groupBorderColor,
                  backgroundColor: colors.surfaceAlt,
                },
              ]}
              testID="order-map-group-back"
              onPress={() =>
                setSelection({session: mapOrderSession, orderId: null})
              }>
              <ChevronLeft
                aria-hidden
                color={colors.text}
                size={20}
                strokeWidth={2.25}
                testID="order-map-group-back-arrow"
              />
              <Text
                style={[
                  styles.backButtonText,
                  {color: colors.text, fontSize: globalFontSize},
                ]}
                testID="order-map-group-back-label">{`Все заказы по адресу (${showOrders.length})`}</Text>
            </TouchableOpacity>
          ) : null}

          {(isGroup ? (selectedOrder ? [selectedOrder] : []) : showOrders).map(
            item => (
              <CardOrder
                FormatPrice={FormatPrice}
                actionButtonOrder={actionButtonOrder}
                dialCall={dialCall}
                globalFontSize={globalFontSize}
                item={item}
                key={item.id}
                setActiveConfirm={setActiveConfirm}
                showAlertText={showAlertText}
              />
            ),
          )}
        </ActionsheetScrollView>

        {isBusy ? (
          <View style={styles.busyOverlay} testID="order-map-sheet-spinner">
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : null}
      </ActionsheetContent>
    </Actionsheet>
  );
};

function OrderGroupList({
  globalFontSize,
  orders,
  onSelect,
}: {
  globalFontSize: number;
  orders: Order[];
  onSelect: (id: number) => void;
}) {
  const {colors, isDark} = useAppTheme();
  const rowBorderColor = isDark
    ? 'rgba(126, 155, 179, 0.42)'
    : 'rgba(66, 98, 125, 0.28)';
  const rowBackground = isDark ? colors.surfaceAlt : colors.surfaceRaised;
  const sortedOrders = [...orders].sort(
    (left, right) => getOrderUrgency(left) - getOrderUrgency(right),
  );

  return (
    <View style={styles.group} testID="order-map-group-list">
      <Text
        style={[
          styles.groupTitle,
          {color: colors.text, fontSize: globalFontSize + 4},
        ]}
        testID="order-map-group-title">
        {getOrdersCountLabel(orders.length)} по адресу
      </Text>
      <Text
        style={[
          styles.groupAddress,
          {color: colors.textMuted, fontSize: globalFontSize},
        ]}
        testID="order-map-group-address">
        {getOrderAddress(orders[0])}
      </Text>

      <View style={styles.groupRows}>
        {sortedOrders.map(item => (
          <TouchableOpacity
            accessibilityLabel={`Открыть заказ ${item.id}`}
            accessibilityRole="button"
            activeOpacity={0.72}
            key={item.id}
            style={[
              styles.groupRow,
              {
                borderColor: rowBorderColor,
                backgroundColor: rowBackground,
              },
            ]}
            testID={`order-map-group-order-${item.id}`}
            onPress={() => onSelect(item.id)}>
            <View style={styles.groupRowContent}>
              <View style={styles.groupRowTitleLine}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        item.point_color || item.color || colors.primary,
                    },
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.groupRowTitle,
                    {color: colors.text, fontSize: globalFontSize},
                  ]}>
                  {item.id_text || `#${item.id}`}
                </Text>
              </View>
              <Text
                style={[
                  styles.groupRowMeta,
                  {
                    color: colors.textMuted,
                    fontSize: Math.max(12, globalFontSize - 1),
                  },
                ]}>
                Пд: {item.pd || '—'} · Эт: {item.et || '—'} · Кв:{' '}
                {item.kv || '—'}
              </Text>
            </View>
            <View style={styles.groupRowTime}>
              <Text
                style={[
                  styles.groupRowTimeText,
                  {
                    color: colors.text,
                    fontSize: Math.max(12, globalFontSize - 1),
                  },
                ]}>
                {item.point_text || item.to_time || ''}
              </Text>
              <Text style={[styles.chevron, {color: colors.textMuted}]}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function getOrdersCountLabel(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? 'заказ'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'заказа'
        : 'заказов';

  return `${count} ${noun}`;
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '75%',
    overflow: 'hidden',
    paddingHorizontal: 0,
    paddingTop: 9,
    paddingBottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: appPalette.softStrong,
  },
  handleArea: {
    width: '100%',
    height: 22,
    backgroundColor: 'transparent',
  },
  handlePressable: {
    width: '100%',
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 62,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(31, 43, 54, 0.2)',
  },
  handleDeleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  scroll: {
    width: '100%',
  },
  group: {
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  groupTitle: {
    fontWeight: '700',
    lineHeight: 28,
  },
  groupAddress: {
    marginTop: 2,
    lineHeight: 22,
  },
  groupRows: {
    gap: 10,
    marginTop: 16,
  },
  groupRow: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupRowContent: {
    flex: 1,
    minWidth: 0,
  },
  groupRowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  groupRowTitle: {
    flex: 1,
    fontWeight: '700',
    lineHeight: 22,
  },
  groupRowMeta: {
    marginTop: 5,
    lineHeight: 19,
  },
  groupRowTime: {
    maxWidth: '42%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupRowTimeText: {
    flexShrink: 1,
    fontWeight: '600',
    textAlign: 'right',
  },
  chevron: {
    fontSize: 28,
    lineHeight: 30,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  backButtonText: {
    fontWeight: '600',
    lineHeight: 22,
  },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
});
