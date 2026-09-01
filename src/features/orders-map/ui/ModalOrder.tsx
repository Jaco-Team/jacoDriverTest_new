import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet'
import {
  CardOrder,
  ORDER_CARD_DELETED_BG,
} from '@/entities/CardOrder/ui/CardOrder'
import { toOrderInt } from '@/entities/CardOrder/model/normalizeOrderValue'
import { appPalette } from '@/shared/styles/appPalette'

import { useModalOrderLogic } from '../model/useModalOrderLogic'

export const ModalOrder = (): React.JSX.Element => {
  const insets = useSafeAreaInsets()
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
  } = useModalOrderLogic()
  const isDeleted =
    showOrders.length > 0 &&
    showOrders.every((item) => toOrderInt(item.is_delete) === 1)
  const sheetBackground = isDeleted ? ORDER_CARD_DELETED_BG : '#FFFFFF'

  function close(): void {
    if (!isBusy) showOrdersMap(-1)
  }

  return (
    <Actionsheet isOpen={isOpenOrderMap} onClose={close}>
      <ActionsheetBackdrop testID="order-map-backdrop" />
      <ActionsheetContent
        style={[styles.sheet, { backgroundColor: sheetBackground }]}
        testID="order-map-sheet"
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator style={styles.handleArea}>
            <Pressable
              accessibilityLabel="Закрыть карточку заказа"
              accessibilityRole="button"
              disabled={isBusy}
              style={styles.handlePressable}
              testID="order-map-sheet-handle"
              onPress={close}
            >
              <View
                style={[
                  styles.handle,
                  isDeleted ? styles.handleDeleted : null,
                ]}
              />
            </Pressable>
          </ActionsheetDragIndicator>
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 14 }}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          testID="order-map-sheet-scroll"
        >
          {showOrders.map((item) => (
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
          ))}
        </ActionsheetScrollView>

        {isBusy ? (
          <View style={styles.busyOverlay} testID="order-map-sheet-spinner">
            <ActivityIndicator color={appPalette.primary} size="large" />
          </View>
        ) : null}
      </ActionsheetContent>
    </Actionsheet>
  )
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
})
