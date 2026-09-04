import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { QrCode } from 'lucide-react-native'

import { toOrderInt } from '@/entities/CardOrder/model/normalizeOrderValue'
import { OrderActionsProps } from '@/entities/CardOrder/model/types'
import { appPalette } from '@/shared/styles/appPalette'

const BUTTON_HEIGHT = 44
const BUTTON_FONT_SIZE = 14
// The site renders the Material phone action as an opaque grey surface.
// A translucent fill blends with deleted-order cards in React Native and
// incorrectly turns the button dark red.
const PHONE_BUTTON_BACKGROUND = '#E0E0E0'

interface ActionButtonProps {
  backgroundColor: string
  children: React.ReactNode
  flex?: number
  minWidth?: number
  paddingHorizontal?: number
  testID: string
  onPress?: () => void
}

function ActionButton({
  backgroundColor,
  children,
  flex,
  minWidth = 100,
  paddingHorizontal = 16,
  testID,
  onPress,
}: ActionButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      style={[
        styles.button,
        { backgroundColor },
        flex === undefined ? null : { flex },
        { minWidth, paddingHorizontal },
      ]}
      testID={testID}
      onPress={onPress}
    >
      {children}
    </Pressable>
  )
}

interface ActionTextProps {
  children: React.ReactNode
  phone?: boolean
}

function ActionText({
  children,
  phone = false,
}: ActionTextProps): React.JSX.Element {
  return (
    <Text
      numberOfLines={1}
      style={phone ? styles.phoneText : styles.actionText}
    >
      {children}
    </Text>
  )
}

export function OrderActions({
  item,
  dialCall,
  setActiveConfirm,
  actionButtonOrder,
}: OrderActionsProps): React.JSX.Element {
  const isGet = toOrderInt(item.is_get)
  const isMy = toOrderInt(item.is_my)
  const isDeleted = toOrderInt(item.is_delete) === 1
  const statusOrder = toOrderInt(item.status_order)
  const onlinePay = toOrderInt(item.online_pay)

  if (isGet === 0) {
    return (
      <View style={styles.actions}>
        <ActionButton
          backgroundColor={PHONE_BUTTON_BACKGROUND}
          testID={`order-${item.id}-phone`}
          onPress={() => dialCall(item.number)}
        >
          <ActionText phone>{item.number}</ActionText>
        </ActionButton>

        <ActionButton
          backgroundColor="#4CAF50"
          testID={`order-${item.id}-take`}
          onPress={() => actionButtonOrder(1, item.id)}
        >
          <ActionText>ВЗЯТЬ</ActionText>
        </ActionButton>
      </View>
    )
  }

  if (isGet === 1 && isMy === 1) {
    return (
      <View style={styles.actions}>
        <View style={styles.row}>
          {statusOrder === 6 ? null : (
            <ActionButton
              backgroundColor="#F44336"
              flex={1}
              testID={`order-${item.id}-cancel`}
              onPress={() =>
                setActiveConfirm(true, item.id, 'cancel', isDeleted)
              }
            >
              <ActionText>ОТМЕНИТЬ</ActionText>
            </ActionButton>
          )}

          <ActionButton
            backgroundColor={PHONE_BUTTON_BACKGROUND}
            flex={1}
            testID={`order-${item.id}-phone`}
            onPress={() => dialCall(item.number)}
          >
            <ActionText phone>{item.number}</ActionText>
          </ActionButton>
        </View>

        {statusOrder === 6 ? null : onlinePay === 0 ? (
          <View style={styles.row}>
            <ActionButton
              backgroundColor="#2196F3"
              flex={1}
              testID={`order-${item.id}-finish`}
              onPress={() =>
                setActiveConfirm(true, item.id, 'finish', isDeleted)
              }
            >
              <ActionText>ЗАВЕРШИТЬ</ActionText>
            </ActionButton>

            <ActionButton
              backgroundColor="#9C27B0"
              minWidth={BUTTON_HEIGHT}
              paddingHorizontal={12}
              testID={`order-${item.id}-qr`}
            >
              <QrCode color="#FFFFFF" size={24} strokeWidth={2} />
            </ActionButton>
          </View>
        ) : (
          <ActionButton
            backgroundColor="#2196F3"
            testID={`order-${item.id}-finish`}
            onPress={() =>
              setActiveConfirm(true, item.id, 'finish', isDeleted)
            }
          >
            <ActionText>ЗАВЕРШИТЬ</ActionText>
          </ActionButton>
        )}

        {statusOrder === 6 ? null : (
          <ActionButton
            backgroundColor="#FF9800"
            testID={`order-${item.id}-fake`}
            onPress={() => setActiveConfirm(true, item.id, 'fake', isDeleted)}
          >
            <ActionText>КЛИЕНТ НЕ ВЫШЕЛ НА СВЯЗЬ</ActionText>
          </ActionButton>
        )}
      </View>
    )
  }

  return (
    <View style={styles.actions}>
      <View
        style={[styles.button, styles.driverInfo]}
        testID={`order-${item.id}-other-name`}
      >
        <Text numberOfLines={1} style={styles.phoneText}>
          Водитель: {item.driver_name}
        </Text>
      </View>

      <ActionButton
        backgroundColor={PHONE_BUTTON_BACKGROUND}
        testID={`order-${item.id}-other-login`}
        onPress={() => dialCall(item.driver_login ?? '')}
      >
        <ActionText phone>{item.driver_login}</ActionText>
      </ActionButton>
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {
    width: '100%',
    gap: 8,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    height: BUTTON_HEIGHT,
    minHeight: BUTTON_HEIGHT,
    maxHeight: BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontSize: BUTTON_FONT_SIZE,
    lineHeight: 17,
  },
  phoneText: {
    color: appPalette.text,
    fontFamily: 'Roboto-Medium',
    fontSize: BUTTON_FONT_SIZE,
    lineHeight: 17,
  },
  driverInfo: {
    minWidth: 0,
    backgroundColor: PHONE_BUTTON_BACKGROUND,
  },
})
