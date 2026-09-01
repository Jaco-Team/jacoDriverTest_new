import React, { useEffect, useMemo, useState } from 'react'
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/ru'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet'
import { appPalette } from '@/shared/styles/appPalette'
import type { PriceDatePickerSheetProps } from '../model/types'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const
const CALENDAR_CELLS = 42
const CALENDAR_CONTENT_HEIGHT = 458
const MAX_SHEET_HEIGHT_PERCENT = 75

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value
}

function getMonthCells(month: Dayjs): Array<Dayjs | null> {
  const firstDayOffset = (month.startOf('month').day() + 6) % 7
  const daysInMonth = month.daysInMonth()

  return Array.from({ length: CALENDAR_CELLS }, (_, index) => {
    const dayOfMonth = index - firstDayOffset + 1

    if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
      return null
    }

    return month.date(dayOfMonth)
  })
}

export function PriceDatePickerSheet({
  isOpen,
  title,
  value,
  minDate,
  maxDate,
  onClose,
  onSelect,
}: PriceDatePickerSheetProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const [visibleMonth, setVisibleMonth] = useState(() => dayjs(value).startOf('month'))

  useEffect(() => {
    if (isOpen) {
      setVisibleMonth(dayjs(value).startOf('month'))
    }
  }, [isOpen, value])

  const minDay = useMemo(() => dayjs(minDate).startOf('day'), [minDate])
  const maxDay = useMemo(() => dayjs(maxDate).startOf('day'), [maxDate])
  const selectedDay = useMemo(() => dayjs(value).startOf('day'), [value])
  const monthCells = useMemo(() => getMonthCells(visibleMonth), [visibleMonth])
  const monthWeeks = useMemo(
    () => Array.from({ length: CALENDAR_CELLS / 7 }, (_, weekIndex) => (
      monthCells.slice(weekIndex * 7, weekIndex * 7 + 7)
    )),
    [monthCells],
  )
  const monthLabel = capitalize(visibleMonth.locale('ru').format('MMMM YYYY'))
  const canShowPreviousMonth = visibleMonth.startOf('month').isAfter(minDay.startOf('month'))
  const canShowNextMonth = visibleMonth.startOf('month').isBefore(maxDay.startOf('month'))
  const androidSnapPoints = useMemo(() => {
    if (Platform.OS !== 'android') return undefined

    const screenHeight = Dimensions.get('screen').height
    const desiredHeight = Math.min(
      CALENDAR_CONTENT_HEIGHT + insets.bottom,
      screenHeight * (MAX_SHEET_HEIGHT_PERCENT / 100),
    )

    return [(desiredHeight / screenHeight) * 100]
  }, [insets.bottom])

  return (
    <Actionsheet
      isOpen={isOpen}
      snapPoints={androidSnapPoints}
      onClose={onClose}
    >
      <ActionsheetBackdrop testID="price-date-picker-backdrop" />
      <ActionsheetContent
        style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}
        testID="price-date-picker-sheet"
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator style={styles.handleArea}>
            <View style={styles.handle} />
          </ActionsheetDragIndicator>
        </ActionsheetDragIndicatorWrapper>

        <Text style={styles.title} testID="price-date-picker-title">
          {title}
        </Text>

        <View style={styles.monthHeader}>
          <Pressable
            accessibilityLabel="Предыдущий месяц"
            accessibilityRole="button"
            disabled={!canShowPreviousMonth}
            style={[styles.monthButton, !canShowPreviousMonth && styles.monthButtonDisabled]}
            testID="price-date-picker-previous-month"
            onPress={() => setVisibleMonth((month) => month.subtract(1, 'month'))}
          >
            <ChevronLeft color={appPalette.text} size={24} />
          </Pressable>

          <Text style={styles.monthLabel}>
            {monthLabel}
          </Text>

          <Pressable
            accessibilityLabel="Следующий месяц"
            accessibilityRole="button"
            disabled={!canShowNextMonth}
            style={[styles.monthButton, !canShowNextMonth && styles.monthButtonDisabled]}
            testID="price-date-picker-next-month"
            onPress={() => setVisibleMonth((month) => month.add(1, 'month'))}
          >
            <ChevronRight color={appPalette.text} size={24} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((weekday) => (
            <Text key={weekday} style={styles.weekday}>
              {weekday}
            </Text>
          ))}
        </View>

        <View style={styles.days} testID="price-date-picker-calendar">
          {monthWeeks.map((week, weekIndex) => (
            <View
              key={`week-${weekIndex}`}
              style={styles.week}
              testID={`price-date-picker-week-${weekIndex}`}
            >
              {week.map((date, dayIndex) => {
                const cellIndex = weekIndex * 7 + dayIndex

                if (!date) {
                  return (
                    <View
                      key={`empty-${cellIndex}`}
                      style={styles.dayCell}
                      testID={`price-date-empty-${cellIndex}`}
                    />
                  )
                }

                const normalizedDate = date.startOf('day')
                const disabled = normalizedDate.isBefore(minDay) || normalizedDate.isAfter(maxDay)
                const selected = normalizedDate.isSame(selectedDay, 'day')
                const today = normalizedDate.isSame(dayjs(), 'day')
                const dateKey = normalizedDate.format('YYYY-MM-DD')

                return (
                  <View key={dateKey} style={styles.dayCell}>
                    <Pressable
                      accessibilityLabel={normalizedDate.locale('ru').format('D MMMM YYYY')}
                      accessibilityRole="button"
                      accessibilityState={{ disabled, selected }}
                      disabled={disabled}
                      style={[
                        styles.dayButton,
                        today && styles.todayButton,
                        selected && styles.selectedDayButton,
                      ]}
                      testID={`price-date-${dateKey}`}
                      onPress={() => onSelect(dateKey)}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          disabled && styles.disabledDayText,
                          selected && styles.selectedDayText,
                        ]}
                      >
                        {date.date()}
                      </Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      </ActionsheetContent>
    </Actionsheet>
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
  title: {
    minHeight: 36,
    paddingHorizontal: 8,
    paddingBottom: 6,
    color: appPalette.primaryDeep,
    fontFamily: 'Roboto-Bold',
    fontSize: 19,
    lineHeight: 25,
    textAlign: 'center',
  },
  monthHeader: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  monthButtonDisabled: {
    opacity: 0.28,
  },
  monthLabel: {
    flex: 1,
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
  weekRow: {
    width: '100%',
    flexDirection: 'row',
    paddingHorizontal: 2,
  },
  weekday: {
    flex: 1,
    paddingVertical: 7,
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Medium',
    fontSize: 13,
    textAlign: 'center',
  },
  days: {
    width: '100%',
    paddingBottom: 4,
  },
  week: {
    width: '100%',
    flexDirection: 'row',
  },
  dayCell: {
    minWidth: 0,
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  todayButton: {
    borderColor: appPalette.brand,
  },
  selectedDayButton: {
    borderColor: appPalette.brand,
    backgroundColor: appPalette.brand,
  },
  dayText: {
    color: appPalette.text,
    fontFamily: 'Roboto-Regular',
    fontSize: 15,
  },
  disabledDayText: {
    color: 'rgba(107, 120, 131, 0.36)',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
  },
})
