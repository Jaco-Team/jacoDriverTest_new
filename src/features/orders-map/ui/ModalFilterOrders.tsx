import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet'
import { appPalette } from '@/shared/styles/appPalette'

import { useModalFilterOrdersLogic } from '../model/useModalOrderLogic'

function clampFontSize(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export const ModalFilterOrders = (): React.JSX.Element => {
  const insets = useSafeAreaInsets()
  const {
    globalFontSize,
    types_dop: typesDop,
    type_dop: typeDop,
    is_showModalTypeDop: isOpen,
    showModalTypeDop,
    setTypeDop,
  } = useModalFilterOrdersLogic()
  const titleFontSize = clampFontSize(globalFontSize + 4, 18, 24)
  const helperFontSize = clampFontSize(globalFontSize - 1, 13, 16)
  const actionFontSize = clampFontSize(globalFontSize + 1, 14, 18)

  function close(): void {
    showModalTypeDop(false)
  }

  function toggle(value: string): void {
    setTypeDop(
      typeDop.includes(value)
        ? typeDop.filter((item) => item !== value)
        : [...typeDop, value],
    )
  }

  return (
    <Actionsheet isOpen={isOpen} onClose={close}>
      <ActionsheetBackdrop testID="orders-filter-backdrop" />
      <ActionsheetContent
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 28 },
        ]}
        testID="orders-filter-sheet"
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator style={styles.handleArea}>
            <Pressable
              accessibilityLabel="Закрыть фильтр заказов"
              accessibilityRole="button"
              style={styles.handlePressable}
              testID="orders-filter-sheet-handle"
              onPress={close}
            >
              <View style={styles.handle} />
            </Pressable>
          </ActionsheetDragIndicator>
        </ActionsheetDragIndicatorWrapper>

        <Text
          style={[
            styles.title,
            {
              fontSize: titleFontSize,
              lineHeight: Math.round(titleFontSize * 1.2),
            },
          ]}
        >
          Активные заказы
        </Text>
        <Text
          style={[
            styles.helper,
            {
              fontSize: helperFontSize,
              lineHeight: Math.round(helperFontSize * 1.4),
            },
          ]}
        >
          Какие статусы показывать
        </Text>

        <View style={styles.options}>
          {typesDop.map((item) => {
            const value = String(item.id)
            const selected = typeDop.includes(value)

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={item.id}
                style={[
                  styles.option,
                  selected ? styles.optionSelected : styles.optionIdle,
                ]}
                testID={`orders-filter-option-${item.id}`}
                onPress={() => toggle(value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: selected ? '#FFFFFF' : appPalette.text,
                      fontSize: actionFontSize,
                    },
                  ]}
                >
                  {item.text}
                </Text>
                {selected ? (
                  <Check color="#FFFFFF" size={20} strokeWidth={2.5} />
                ) : (
                  <View style={styles.checkPlaceholder} />
                )}
              </Pressable>
            )
          })}
        </View>
      </ActionsheetContent>
    </Actionsheet>
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
  title: {
    width: '100%',
    marginBottom: 4,
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
    textAlign: 'left',
  },
  helper: {
    width: '100%',
    marginBottom: 16,
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Regular',
    textAlign: 'left',
  },
  options: {
    width: '100%',
    gap: 8,
  },
  option: {
    width: '100%',
    height: 44,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  optionSelected: {
    backgroundColor: appPalette.brand,
  },
  optionIdle: {
    backgroundColor: appPalette.surfaceAlt,
  },
  optionText: {
    flex: 1,
    fontFamily: 'Roboto-Bold',
    lineHeight: 21,
  },
  checkPlaceholder: {
    width: 20,
  },
})
