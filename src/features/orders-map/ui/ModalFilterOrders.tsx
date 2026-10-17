import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet'
import { appPalette } from '@/shared/styles/appPalette'

import { useModalFilterOrdersLogic } from '../model/useModalOrderLogic'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'
import { scaleGlobalFontSize } from '@/shared/lib/fontSize'

export const ModalFilterOrders = (): React.JSX.Element => {
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useAppTheme()
  const {
    globalFontSize,
    types_dop: typesDop,
    type_dop: typeDop,
    is_showModalTypeDop: isOpen,
    showModalTypeDop,
    setTypeDop,
    statusCounts,
  } = useModalFilterOrdersLogic()
  const titleFontSize = scaleGlobalFontSize(20, globalFontSize, 18, 24)
  const helperFontSize = scaleGlobalFontSize(15, globalFontSize, 13, 18)
  const actionFontSize = scaleGlobalFontSize(17, globalFontSize, 14, 22)
  const isFilterActive = typeDop.length < typesDop.length

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
          { borderColor: colors.border, backgroundColor: colors.surfaceRaised, paddingBottom: insets.bottom + 28 },
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
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
            </Pressable>
          </ActionsheetDragIndicator>
        </ActionsheetDragIndicatorWrapper>

        <View style={styles.header}>
          <View style={styles.headingText}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
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
                  color: colors.textMuted,
                  fontSize: helperFontSize,
                  lineHeight: Math.round(helperFontSize * 1.4),
                },
              ]}
            >
              Какие статусы показывать
            </Text>
          </View>
          <View style={styles.resetSlot}>
            {isFilterActive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Сбросить фильтр"
                testID="orders-filter-reset"
                onPress={() => setTypeDop(typesDop.map((item) => String(item.id)))}
                style={({ pressed }) => [
                  styles.resetButton,
                  { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' },
                ]}
              >
                <Svg
                  width={26}
                  height={26}
                  viewBox="0 0 24 24"
                  testID="orders-filter-reset-icon"
                >
                  <Path
                    d="M3 4H14M3 4L10 13V20L14 22V13L16 11M17 3L22 8M22 3L17 8"
                    fill="none"
                    stroke={colors.text}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    testID="orders-filter-reset-icon-path"
                  />
                </Svg>
              </Pressable>
            ) : null}
          </View>
        </View>

        <ActionsheetScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          testID="orders-filter-sheet-scroll"
        >
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
                    {
                      backgroundColor: selected
                        ? colors.brand
                        : colors.surfaceAlt,
                    },
                  ]}
                  testID={`orders-filter-option-${item.id}`}
                  onPress={() => toggle(value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: selected ? '#FFFFFF' : colors.text,
                        fontSize: actionFontSize,
                        lineHeight: Math.round(actionFontSize * 1.25),
                      },
                    ]}
                  >
                    {item.text}
                  </Text>
                  <Text
                    style={[
                      styles.count,
                      {
                        color: selected ? '#FFFFFF' : colors.textMuted,
                        fontSize: actionFontSize,
                        lineHeight: Math.round(actionFontSize * 1.25),
                      },
                    ]}
                    testID={`orders-filter-count-${item.id}`}
                  >
                    {statusCounts[value] ?? 0}
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
        </ActionsheetScrollView>
        <Pressable
          accessibilityRole="button"
          onPress={close}
          style={[styles.doneButton, {
            borderColor: colors.border,
            backgroundColor: isDark ? undefined : '#E0E0E0',
          }]}
          testID="orders-filter-done"
        >
          <Text
            style={[
              styles.doneText,
              {
                color: colors.text,
                fontSize: actionFontSize,
                lineHeight: Math.round(actionFontSize * 1.25),
              },
            ]}
          >
            Готово
          </Text>
        </Pressable>
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
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Regular',
    textAlign: 'left',
  },
  header: {
    width: '100%',
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  headingText: {
    flex: 1,
    minWidth: 0,
  },
  resetSlot: {
    width: 44,
    height: 44,
    flexShrink: 0,
  },
  resetButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  options: {
    width: '100%',
    gap: 8,
  },
  scroll: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 1,
  },
  option: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  },
  count: {
    marginHorizontal: 12,
    fontFamily: 'Roboto-Bold',
    fontVariant: ['tabular-nums'],
  },
  doneButton: {
    width: '100%',
    flexShrink: 0,
    minHeight: 44,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
  },
  checkPlaceholder: {
    width: 20,
  },
})
