import React from 'react'
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {Actionsheet, ActionsheetBackdrop, ActionsheetContent} from '@/components/ui/actionsheet'
import {useOrdersStore, useGlobalStore} from '@/shared/store/store'
import type {DeletedOrderNotice} from '@/shared/store/OrdersStoreType'
import {useAppTheme} from '@/shared/theme/AppThemeProvider'

type DeletedOrdersSheetProps = {
  orders: DeletedOrderNotice[]
  isOpen: boolean
  busy?: boolean
  onConfirm: () => void | Promise<void>
}

export function DeletedOrdersSheet({orders, isOpen, busy = false, onConfirm}: DeletedOrdersSheetProps): React.JSX.Element | null {
  const {bottom} = useSafeAreaInsets()
  const {colors, resolvedScheme} = useAppTheme()
  const globalFontSize = useGlobalStore(state => state.globalFontSize)
  const handleColor = resolvedScheme === 'dark' ? 'rgba(243, 246, 248, 0.28)' : 'rgba(31, 43, 54, 0.2)'

  if (!isOpen || orders.length === 0) return null

  const confirm = () => {
    if (!busy) void onConfirm()
  }

  return (
    <Actionsheet isOpen={isOpen} onClose={confirm}>
      <ActionsheetBackdrop testID="deleted-orders-backdrop" />
      <ActionsheetContent
        style={[styles.sheet, {backgroundColor: colors.surfaceRaised, borderColor: colors.border, paddingBottom: bottom + 20}]}
        testID="deleted-orders-sheet"
      >
        <Pressable
          accessibilityLabel="Закрыть уведомление об удалённых заказах"
          accessibilityRole="button"
          disabled={busy}
          onPress={confirm}
          style={styles.handleButton}
        >
          <View style={[styles.handle, {backgroundColor: handleColor}]} />
        </Pressable>

        <Text style={[styles.title, {color: colors.text, fontSize: Math.min(Math.max(globalFontSize + 3, 17), 23)}]}>
          Удалённые заказы
        </Text>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {orders.map(order => (
            <View key={order.id} style={[styles.order, {backgroundColor: resolvedScheme === 'dark' ? colors.surfacePressed : colors.surface, borderColor: colors.border}]}>
              <Text style={[styles.orderNumber, {color: colors.text, fontSize: globalFontSize}]}>
                Заказ №{order.id}
              </Text>
              <Text style={[styles.orderAddress, {color: colors.textMuted, fontSize: globalFontSize}]}>
                Адрес: {order.addr}
              </Text>
            </View>
          ))}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={confirm}
          style={[styles.button, {backgroundColor: colors.brand, opacity: busy ? 0.7 : 1}]}
          testID="deleted-orders-confirm"
        >
          <Text style={[styles.buttonText, {color: '#FFFFFF', fontSize: globalFontSize}]}>Хорошо</Text>
        </Pressable>
      </ActionsheetContent>
    </Actionsheet>
  )
}

export function DeletedOrdersNotification(): React.JSX.Element {
  const orders = useOrdersStore(state => state.del_orders)
  const busy = useOrdersStore(state => state.isHidingDelOrders)
  const hideDelOrders = useOrdersStore(state => state.hideDelOrders)

  return (
    <DeletedOrdersSheet
      orders={orders}
      isOpen={orders.length > 0}
      busy={busy}
      onConfirm={hideDelOrders}
    />
  )
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    maxHeight: '75%',
    padding: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  handleButton: {
    width: '100%',
    height: 32,
    alignItems: 'center',
    paddingTop: 12,
  },
  handle: {width: 62, height: 6, borderRadius: 999},
  title: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    lineHeight: 28,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  list: {alignSelf: 'stretch', maxHeight: 280, flexGrow: 0, flexShrink: 1},
  listContent: {paddingHorizontal: 20, gap: 10},
  order: {paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderRadius: 16, gap: 6},
  orderNumber: {fontFamily: 'Roboto-Bold', fontWeight: '700', lineHeight: 21},
  orderAddress: {fontFamily: 'Roboto-Regular', lineHeight: 22},
  button: {
    alignSelf: 'stretch',
    minHeight: 50,
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {fontFamily: 'Roboto-Bold', fontWeight: '700'},
})
