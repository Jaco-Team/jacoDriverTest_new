import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/ru'
import { useShallow } from 'zustand/react/shallow'

import { Analytics, AnalyticsEvent } from '@/analytics/AppMetricaService'
import { useGlobalStore, useStatStore } from '@/shared/store/store'

const MAX_SPAN_DAYS = 93
const API_DATE_FORMAT = 'YYYY-MM-DD'
const UI_DATE_FORMAT = 'D MMMM YYYY'

type ActiveStatisticsPicker = 'start' | 'end' | null

type ClampReason =
  | 'afterToday'
  | 'beforeMin'
  | 'endBeforeStart'
  | 'spanTooLong'
  | 'spanTrimmedByToday'
  | 'spanTrimmedByMin'

function formatApiDate(date: Dayjs): string {
  return dayjs(date).format(API_DATE_FORMAT)
}

function minDay(first: Dayjs, second: Dayjs): Dayjs {
  return first.isBefore(second) ? first : second
}

function maxDay(first: Dayjs, second: Dayjs): Dayjs {
  return first.isAfter(second) ? first : second
}

export function useStatisticsTable() {
  const [getStatistics, statArr] = useStatStore(
    useShallow((state) => [state.getStatistics, state.statArr]),
  )
  const [globalFontSize, showAlertText] = useGlobalStore(
    useShallow((state) => [state.globalFontSize, state.showAlertText]),
  )

  const [initialStartDate] = useState(() => dayjs().startOf('day').subtract(6, 'day'))
  const [initialEndDate] = useState(() => dayjs().startOf('day'))
  const [dateStart, setDateStart] = useState(initialStartDate)
  const [dateEnd, setDateEnd] = useState(initialEndDate)
  const [activePicker, setActivePicker] = useState<ActiveStatisticsPicker>(null)

  const today = dayjs().startOf('day')
  const globalMinDate = today.subtract(MAX_SPAN_DAYS, 'day')

  const normalizeRangeWithReasons = useCallback((start: Dayjs, end: Dayjs) => {
    let normalizedStart = dayjs(start).startOf('day')
    let normalizedEnd = dayjs(end).startOf('day')
    const reasons: ClampReason[] = []

    if (normalizedStart.isAfter(today)) {
      normalizedStart = today
      reasons.push('afterToday')
    }
    if (normalizedStart.isBefore(globalMinDate)) {
      normalizedStart = globalMinDate
      reasons.push('beforeMin')
    }
    if (normalizedEnd.isAfter(today)) {
      normalizedEnd = today
      reasons.push('spanTrimmedByToday')
    }
    if (normalizedEnd.isBefore(globalMinDate)) {
      normalizedEnd = globalMinDate
      reasons.push('spanTrimmedByMin')
    }
    if (normalizedEnd.isBefore(normalizedStart)) {
      normalizedEnd = normalizedStart
      reasons.push('endBeforeStart')
    }

    if (normalizedEnd.diff(normalizedStart, 'day') > MAX_SPAN_DAYS) {
      normalizedEnd = normalizedStart.add(MAX_SPAN_DAYS, 'day')
      reasons.push('spanTooLong')

      if (normalizedEnd.isAfter(today)) {
        normalizedEnd = today
        normalizedStart = today.subtract(MAX_SPAN_DAYS, 'day')
        reasons.push('spanTrimmedByToday')
      }
    }

    return { start: normalizedStart, end: normalizedEnd, reasons }
  }, [globalMinDate, today])

  const showAdjustmentIfNeeded = useCallback((
    reasons: ClampReason[],
    start: Dayjs,
    end: Dayjs,
  ) => {
    if (reasons.length === 0) return

    const messages: string[] = []
    if (reasons.includes('afterToday')) {
      messages.push('Дата "от" не может быть позже сегодняшней.')
    }
    if (reasons.includes('beforeMin')) {
      messages.push(`Дата "от" не может быть раньше ${formatApiDate(globalMinDate)}.`)
    }
    if (reasons.includes('endBeforeStart')) {
      messages.push('Дата "до" не может быть раньше "от".')
    }
    if (reasons.includes('spanTooLong')) {
      messages.push(`Диапазон не может превышать ${MAX_SPAN_DAYS} дней.`)
    }
    if (reasons.includes('spanTrimmedByToday')) {
      messages.push('Дата "до" ограничена сегодняшним днём.')
    }
    if (reasons.includes('spanTrimmedByMin')) {
      messages.push(`Дата "от" ограничена ${formatApiDate(globalMinDate)}.`)
    }
    messages.push(`Выбран период: ${formatApiDate(start)} — ${formatApiDate(end)}`)

    showAlertText(true, messages.join('\n'))
  }, [globalMinDate, showAlertText])

  useEffect(() => {
    getStatistics(formatApiDate(initialStartDate), formatApiDate(initialEndDate))
  }, [getStatistics, initialEndDate, initialStartDate])

  const openPicker = useCallback((type: Exclude<ActiveStatisticsPicker, null>) => {
    setActivePicker(type)
    Analytics.log(
      type === 'start'
        ? AnalyticsEvent.StatisticsCalendarStartOpen
        : AnalyticsEvent.StatisticsCalendarEndOpen,
      type === 'start'
        ? 'Открытие календаря (Статистика времени): Дата от'
        : 'Открытие календаря (Статистика времени): Дата до',
    )
  }, [])

  const closePicker = useCallback(() => {
    if (activePicker === 'start') {
      Analytics.log(
        AnalyticsEvent.StatisticsCalendarStartClose,
        'Закрытие календаря (Статистика времени): Дата от',
      )
    }
    if (activePicker === 'end') {
      Analytics.log(
        AnalyticsEvent.StatisticsCalendarEndClose,
        'Закрытие календаря (Статистика времени): Дата до',
      )
    }
    setActivePicker(null)
  }, [activePicker])

  const selectPickerDate = useCallback((value: string) => {
    if (!activePicker) return

    const picked = dayjs(value).startOf('day')
    const normalized = activePicker === 'start'
      ? normalizeRangeWithReasons(picked, dateEnd)
      : normalizeRangeWithReasons(dateStart, picked)

    Analytics.log(
      AnalyticsEvent.StatisticsDateSelected,
      'Выбор даты (Статистика времени)',
    )
    setDateStart(normalized.start)
    setDateEnd(normalized.end)
    showAdjustmentIfNeeded(normalized.reasons, normalized.start, normalized.end)
    getStatistics(formatApiDate(normalized.start), formatApiDate(normalized.end))
    closePicker()
  }, [
    activePicker,
    closePicker,
    dateEnd,
    dateStart,
    getStatistics,
    normalizeRangeWithReasons,
    showAdjustmentIfNeeded,
  ])

  const getStat = useCallback(() => {
    const normalized = normalizeRangeWithReasons(dateStart, dateEnd)

    Analytics.log(
      AnalyticsEvent.StatisticsShowClick,
      'Показать статистику времени',
    )
    setDateStart(normalized.start)
    setDateEnd(normalized.end)
    showAdjustmentIfNeeded(normalized.reasons, normalized.start, normalized.end)
    getStatistics(formatApiDate(normalized.start), formatApiDate(normalized.end))
  }, [
    dateEnd,
    dateStart,
    getStatistics,
    normalizeRangeWithReasons,
    showAdjustmentIfNeeded,
  ])

  const isSummaryRow = useCallback((row: (typeof statArr)[number]) => {
    return !row?.driver_id && !row?.name
  }, [])
  const displayRows = useMemo(() => {
    const courierRows = statArr.filter((row) => !isSummaryRow(row))
    const summaryRows = statArr.filter((row) => isSummaryRow(row))
    return [...courierRows, ...summaryRows]
  }, [isSummaryRow, statArr])

  const startMinAllowed = maxDay(globalMinDate, dateEnd.subtract(MAX_SPAN_DAYS, 'day'))
  const startMaxAllowed = minDay(today, dateEnd)
  const endMinAllowed = maxDay(globalMinDate, dateStart)
  const endMaxAllowed = minDay(today, dateStart.add(MAX_SPAN_DAYS, 'day'))

  return {
    activePicker,
    closePicker,
    dateEnd: formatApiDate(dateEnd),
    dateEndLabel: dateEnd.locale('ru').format(UI_DATE_FORMAT),
    dateStart: formatApiDate(dateStart),
    dateStartLabel: dateStart.locale('ru').format(UI_DATE_FORMAT),
    displayRows,
    getStat,
    globalFontSize,
    isSummaryRow,
    openPicker,
    pickerMaxDate: formatApiDate(activePicker === 'start' ? startMaxAllowed : endMaxAllowed),
    pickerMinDate: formatApiDate(activePicker === 'start' ? startMinAllowed : endMinAllowed),
    pickerTitle: activePicker === 'start' ? 'Дата от' : activePicker === 'end' ? 'Дата до' : '',
    pickerValue: formatApiDate(activePicker === 'start' ? dateStart : dateEnd),
    selectPickerDate,
    statArr,
  }
}
