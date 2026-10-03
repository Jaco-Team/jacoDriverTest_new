import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet'
import { Analytics, AnalyticsEvent } from '@/analytics/AppMetricaService'
import { appPalette } from '@/shared/styles/appPalette'
import { useChooseMonthLogic } from '../model/useChooseMonthLogic'
import { useGraphStyles } from './graphStyles'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'
import { useIsOffline } from '@/shared/ui/ConnectivityLocationIndicator'

// Полупрозрачный appPalette.soft вместе с elevation даёт на Android белый
// прямоугольник под Text. Это тот же цвет, заранее смешанный с белым фоном.
const SELECTED_MONTH_BACKGROUND = '#F0F2F5'

export function ChooseMonth(): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useAppTheme()
  const graphStyles = useGraphStyles()
  const isOffline = useIsOffline()
  const selectedMonthBackground = isDark
    ? colors.surfaceAlt
    : SELECTED_MONTH_BACKGROUND
  const {
    month_list,
    activeMounth,
    isOpenDateMenu,
    setIsOpenDateMenu,
    onSelectMonth,
    globalFontSize,
  } = useChooseMonthLogic()

  const openMonthPicker = () => {
    if (isOffline) return
    Analytics.log(
      AnalyticsEvent.GraphMonthPickerOpen,
      'Открытие выбора месяца (График работы)',
    )
    setIsOpenDateMenu(true)
  }

  const closeMonthPicker = () => {
    Analytics.log(
      AnalyticsEvent.GraphMonthPickerClose,
      'Закрытие выбора месяца (График работы)',
    )
    setIsOpenDateMenu(false)
  }

  React.useEffect(() => {
    if (isOffline && isOpenDateMenu) setIsOpenDateMenu(false)
  }, [isOffline, isOpenDateMenu, setIsOpenDateMenu])

  return (
    <>
      <View style={[graphStyles.card, graphStyles.hero]} testID="graph-month-card">
        <Text style={graphStyles.eyebrow}>График работы</Text>

        <Pressable
          accessibilityLabel="Выбрать месяц"
          accessibilityRole="button"
          accessibilityState={{ disabled: isOffline }}
          disabled={isOffline}
          style={[
            graphStyles.monthButton,
            isOffline && { backgroundColor: colors.softStrong, opacity: 0.7 },
          ]}
          testID="graph-month-trigger"
          onPress={openMonthPicker}
        >
          <Text
            numberOfLines={1}
            style={[
              graphStyles.monthButtonText,
              {
                color: isOffline ? colors.textMuted : colors.text,
                fontSize: globalFontSize,
              },
            ]}
          >
            {!isOffline && activeMounth ? activeMounth : 'Выберите месяц'}
          </Text>
          <ChevronDown color={isOffline ? colors.textMuted : colors.text} size={22} />
        </Pressable>
      </View>

      <Actionsheet isOpen={isOpenDateMenu} onClose={closeMonthPicker}>
        <ActionsheetBackdrop testID="graph-month-backdrop" />
        <ActionsheetContent
          style={[styles.sheet, { borderColor: colors.border, backgroundColor: colors.surfaceRaised, paddingBottom: insets.bottom + 30 }]}
          testID="graph-month-sheet"
        >
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator style={styles.handleArea}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
            </ActionsheetDragIndicator>
          </ActionsheetDragIndicatorWrapper>

          <View style={styles.monthList}>
            {month_list.map((item, index) => {
              const selected = item.is_active === 1

              return (
                <Pressable
                  accessibilityState={{ selected }}
                  accessibilityRole="button"
                  key={`${item.day}-${index}`}
                  style={[
                    styles.monthItem,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? selectedMonthBackground : colors.surfaceRaised,
                      shadowColor: colors.shadowStrong,
                    },
                  ]}
                  testID={`graph-month-option-${item.day}`}
                  onPress={() => {
                    Analytics.log(
                      AnalyticsEvent.GraphMonthSelected,
                      'Выбор месяца (График работы)',
                    )
                    Analytics.log(
                      AnalyticsEvent.GraphMonthPickerClose,
                      'Закрытие выбора месяца (График работы)',
                    )
                    onSelectMonth(item.day, item.mounth)
                  }}
                >
                  <Text
                    style={[
                      styles.monthItemText,
                      selected && styles.monthItemTextSelected,
                      {
                        backgroundColor: selected ? selectedMonthBackground : 'transparent',
                        color: colors.text,
                        fontSize: globalFontSize + 2,
                      },
                    ]}
                  >
                    {item.mounth}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ActionsheetContent>
      </Actionsheet>
    </>
  )
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '75%',
    overflow: 'hidden',
    paddingTop: 8,
    paddingHorizontal: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: appPalette.softStrong,
    backgroundColor: '#FFFFFF',
  },
  handleArea: {
    width: '100%',
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  handle: {
    width: 68,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(31, 43, 54, 0.16)',
  },
  monthList: {
    width: '100%',
    gap: 12,
    paddingTop: 4,
  },
  monthItem: {
    width: '100%',
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(66, 98, 125, 0.12)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 2,
  },
  monthItemSelected: {
    borderColor: 'rgba(66, 98, 125, 0.22)',
    backgroundColor: SELECTED_MONTH_BACKGROUND,
  },
  monthItemText: {
    width: '100%',
    backgroundColor: 'transparent',
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
  },
  monthItemTextSelected: {
    backgroundColor: SELECTED_MONTH_BACKGROUND,
    color: appPalette.primaryDeep,
  },
})
