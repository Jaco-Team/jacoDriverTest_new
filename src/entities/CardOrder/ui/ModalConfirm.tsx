import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useShallow } from 'zustand/react/shallow'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet'
import { appPalette } from '@/shared/styles/appPalette'
import { useGlobalStore, useOrdersStore } from '@/shared/store/store'

export type OrderConfirmType = '' | 'fake' | 'finish' | 'cancel'

interface ConfirmConfig {
  title: string
  message: string
  confirmText: string
  confirmColor: string
  iconBackground: string
  iconName: 'check-circle' | 'cancel' | 'person-off' | 'warning'
}

interface OrderConfirmModalProps {
  isOpen: boolean
  orderId: number
  typeConfirm: OrderConfirmType
  globalFontSize: number
  busy?: boolean
  onClose: () => void
  onConfirm: () => void
}

function clampFontSize(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getConfig(
  typeConfirm: OrderConfirmType,
  orderId: number,
): ConfirmConfig {
  const orderLabel = orderId ? `#${orderId}` : ''

  switch (typeConfirm) {
    case 'finish':
      return {
        title: 'Завершить заказ',
        message: `Заказ ${orderLabel} будет отмечен как доставленный.`,
        confirmText: 'Завершить',
        confirmColor: '#2196F3',
        iconBackground: 'rgba(33, 150, 243, 0.10)',
        iconName: 'check-circle',
      }
    case 'cancel':
      return {
        title: 'Отменить заказ',
        message: `Заказ ${orderLabel} вернётся в общую очередь.`,
        confirmText: 'Отменить',
        confirmColor: appPalette.brand,
        iconBackground: 'rgba(204, 0, 51, 0.10)',
        iconName: 'cancel',
      }
    case 'fake':
      return {
        title: 'Клиент не вышел на связь',
        message: `Подтвердите по заказу ${orderLabel}.`,
        confirmText: 'Подтвердить',
        confirmColor: '#FF9800',
        iconBackground: 'rgba(255, 152, 0, 0.10)',
        iconName: 'person-off',
      }
    default:
      return {
        title: 'Подтверждение',
        message: `Подтвердите действие для заказа ${orderLabel}.`,
        confirmText: 'Подтвердить',
        confirmColor: appPalette.primary,
        iconBackground: 'rgba(66, 98, 125, 0.10)',
        iconName: 'warning',
      }
  }
}

export function OrderConfirmModal({
  isOpen,
  orderId,
  typeConfirm,
  globalFontSize,
  busy = false,
  onClose,
  onConfirm,
}: OrderConfirmModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const config = getConfig(typeConfirm, orderId)
  const titleFontSize = clampFontSize(globalFontSize + 4, 18, 24)
  const bodyFontSize = clampFontSize(globalFontSize, 14, 18)
  const actionFontSize = clampFontSize(globalFontSize + 1, 14, 18)

  function close(): void {
    if (!busy) onClose()
  }

  function confirm(): void {
    if (!busy) onConfirm()
  }

  return (
    <Actionsheet isOpen={isOpen} onClose={close}>
      <ActionsheetBackdrop testID="order-confirm-backdrop" />
      <ActionsheetContent
        style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}
        testID="order-confirm-sheet"
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator style={styles.handleArea}>
            <Pressable
              accessibilityLabel="Закрыть подтверждение"
              accessibilityRole="button"
              disabled={busy}
              style={styles.handlePressable}
              testID="order-confirm-handle"
              onPress={close}
            >
              <View style={styles.handle} />
            </Pressable>
          </ActionsheetDragIndicator>
        </ActionsheetDragIndicatorWrapper>

        <View style={styles.headingRow} testID="order-confirm-modal">
          <View
            style={[
              styles.iconBox,
              { backgroundColor: config.iconBackground },
            ]}
          >
            <MaterialIcons
              color={config.confirmColor}
              name={config.iconName}
              size={24}
              testID={`order-confirm-icon-${config.iconName}`}
            />
          </View>
          <Text
            style={[
              styles.title,
              {
                fontSize: titleFontSize,
                lineHeight: Math.round(titleFontSize * 1.2),
              },
            ]}
            testID="order-confirm-title"
          >
            {config.title}
          </Text>
        </View>

        <Text
          style={[
            styles.message,
            {
              fontSize: bodyFontSize,
              lineHeight: Math.round(bodyFontSize * 1.45),
            },
          ]}
          testID="order-confirm-message"
        >
          {config.message}
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={[styles.actionButton, styles.cancelButton]}
            testID="order-confirm-no"
            onPress={close}
          >
            <Text
              style={[
                styles.actionText,
                { color: appPalette.text, fontSize: actionFontSize },
              ]}
            >
              Нет
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel={config.confirmText}
            accessibilityRole="button"
            disabled={busy}
            style={[
              styles.actionButton,
              { backgroundColor: config.confirmColor },
            ]}
            testID="order-confirm-submit"
            onPress={confirm}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text
                style={[
                  styles.actionText,
                  { color: '#FFFFFF', fontSize: actionFontSize },
                ]}
              >
                {config.confirmText}
              </Text>
            )}
          </Pressable>
        </View>
      </ActionsheetContent>
    </Actionsheet>
  )
}

export function CardOrderModalConfirm(): React.JSX.Element {
  const [
    isModalConfirm,
    typeConfirm,
    orderConfirmId,
    isClick,
    setActiveConfirm,
    actionButtonOrder,
  ] = useOrdersStore(
    useShallow((state) => [
      state.is_modalConfirm,
      state.type_confirm,
      state.order_confirm_id,
      state.isClick,
      state.setActiveConfirm,
      state.actionButtonOrder,
    ]),
  )
  const globalFontSize = useGlobalStore((state) => state.globalFontSize)

  return (
    <OrderConfirmModal
      busy={isClick}
      globalFontSize={globalFontSize}
      isOpen={isModalConfirm}
      orderId={orderConfirmId}
      typeConfirm={typeConfirm}
      onClose={() => setActiveConfirm(false)}
      onConfirm={() =>
        actionButtonOrder(
          typeConfirm === 'finish' ? 3 : typeConfirm === 'cancel' ? 2 : 1,
          orderConfirmId,
        )
      }
    />
  )
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '75%',
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 9,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: appPalette.softStrong,
    backgroundColor: '#FFFFFF',
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
  headingRow: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  iconBox: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  title: {
    flex: 1,
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
  },
  message: {
    width: '100%',
    alignSelf: 'stretch',
    textAlign: 'left',
    marginBottom: 20,
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Regular',
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    height: 44,
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  cancelButton: {
    backgroundColor: appPalette.surfaceAlt,
  },
  actionText: {
    fontFamily: 'Roboto-Bold',
    lineHeight: 21,
  },
})
