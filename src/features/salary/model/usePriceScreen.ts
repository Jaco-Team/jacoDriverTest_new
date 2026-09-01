import { useState, useEffect, useCallback, useMemo } from 'react'
import { useStatStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'

import { Analytics, AnalyticsEvent } from '@/analytics/AppMetricaService'
import type { ActivePricePicker, PriceMetricRow } from './types'

const API_DATE_FORMAT = 'YYYY-MM-DD'
const UI_DATE_FORMAT = 'D MMMM YYYY'

export function usePriceScreen() {
  const [globalFontSize] = useGlobalStore(useShallow((state) => [state.globalFontSize]))

  const [getStatBetween, statPrice, give_history, FormatPrice] = useStatStore(
    useShallow((state) => [
      state.getStatBetween,
      state.statPrice,
      state.give_history,
      state.FormatPrice
    ])
  )

  const todayIso = dayjs().startOf('day').format(API_DATE_FORMAT)

  const [dateStart, setDateStart] = useState<string>(todayIso)
  const [dateEnd, setDateEnd] = useState<string>(todayIso)
  const [activePicker, setActivePicker] = useState<ActivePricePicker>(null)

  const fetchRange = useCallback((start: string, end: string) => {
    getStatBetween(start, end)
  }, [getStatBetween])

  const openStartPicker = useCallback(() => {
    setActivePicker('start')
    Analytics.log(
      AnalyticsEvent.PriceStartCalendarOpen,
      'Открытие календаря (Расчет): Дата от',
    )
  }, [])

  const openEndPicker = useCallback(() => {
    setActivePicker('end')
    Analytics.log(
      AnalyticsEvent.PriceEndCalendarOpen,
      'Открытие календаря (Расчет): Дата до',
    )
  }, [])

  const closePicker = useCallback(() => {
    if (activePicker === 'start') {
      Analytics.log(
        AnalyticsEvent.PriceStartCalendarClose,
        'Закрытие календаря (Расчет): Дата от',
      )
    }

    if (activePicker === 'end') {
      Analytics.log(
        AnalyticsEvent.PriceEndCalendarClose,
        'Закрытие календаря (Расчет): Дата до',
      )
    }

    setActivePicker(null)
  }, [activePicker])

  const selectPickerDate = useCallback((date: string) => {
    const normalizedDate = dayjs(date).format(API_DATE_FORMAT)

    if (activePicker === 'start') {
      setDateStart(normalizedDate)

      if (dayjs(normalizedDate).isAfter(dateEnd)) {
        setDateEnd(normalizedDate)
      }
    }

    if (activePicker === 'end') {
      setDateEnd(normalizedDate)

      if (dayjs(normalizedDate).isBefore(dateStart)) {
        setDateStart(normalizedDate)
      }
    }

    closePicker()
  }, [activePicker, closePicker, dateEnd, dateStart])

  const showDateStart = useMemo(
    () => dayjs(dateStart).locale('ru').format(UI_DATE_FORMAT),
    [dateStart],
  )
  const showDateEnd = useMemo(
    () => dayjs(dateEnd).locale('ru').format(UI_DATE_FORMAT),
    [dateEnd],
  )
  const minSelectableDate = useMemo(
    () => dayjs(todayIso).subtract(93, 'day').format(API_DATE_FORMAT),
    [todayIso],
  )
  const pickerMinDate = activePicker === 'end' ? dateStart : minSelectableDate
  const pickerMaxDate = activePicker === 'start' ? dateEnd : todayIso
  const pickerValue = activePicker === 'start' ? dateStart : dateEnd
  const pickerTitle = activePicker === 'start' ? 'Дата от' : activePicker === 'end' ? 'Дата до' : ''

  const totalPriceFontSize = useMemo(
    () => Math.max(globalFontSize * 2.6, 48),
    [globalFontSize],
  )

  const formatPriceValue = useCallback((value: number): string => {
    return `${FormatPrice(value)} ₽`
  }, [FormatPrice])

  const formatCountValue = useCallback((value: number): string => {
    return FormatPrice(value)
  }, [FormatPrice])

  const getMetricValue = useCallback((value: number | undefined): number => {
    return value ?? 0
  }, [])

  const summaryRows = useMemo<PriceMetricRow[]>(() => [
    {
      label: 'Сумма налички',
      value: formatPriceValue(getMetricValue(statPrice?.sum_cash)),
      description: 'Сумма заказов за наличку за выбранную дату, включая стоимость доставки',
    },
    {
      label: 'Сумма безнала',
      value: formatPriceValue(getMetricValue(statPrice?.sum_bank)),
      description: 'Сумма заказов по безналичному расчету за выбранную дату, включая стоимость доставки',
    },
    {
      label: 'Заработал',
      value: formatPriceValue(getMetricValue(statPrice?.my_price)),
      description: 'Сумма стоимости доставки для курьера за выбранную дату плюс доплаты за этот же день',
      emphasize: true,
    },
    {
      label: 'Сдача',
      value: formatPriceValue(getMetricValue(statPrice?.sdacha)),
      description: 'Из графы Сумма налички вычитается графа Заработал',
      emphasize: true,
    },
    {
      label: 'Налички',
      value: formatPriceValue(getMetricValue(statPrice?.my_cash)),
      description: 'Разница между графой К сдаче и графой Сдал за все время на точке',
      emphasize: true,
    },
    {
      label: 'Количество по наличке',
      value: formatCountValue(getMetricValue(statPrice?.count_cash)),
      emphasize: true,
    },
    {
      label: 'Количество по безналу',
      value: formatCountValue(getMetricValue(statPrice?.count_bank)),
      emphasize: true,
    },
    {
      label: 'Завершенных заказов',
      value: formatCountValue(getMetricValue(statPrice?.count)),
      emphasize: true,
      hideDivider: true,
    },
  ], [formatCountValue, formatPriceValue, getMetricValue, statPrice])

  const settlementRows = useMemo<PriceMetricRow[]>(() => [
    ...give_history.map((item) => ({
      label: item.time ?? '',
      value: formatPriceValue(item.give ?? 0),
    })),
    {
      label: 'Всего сдал',
      value: formatPriceValue(getMetricValue(statPrice?.full_give)),
      emphasize: true,
    },
    {
      label: 'Осталось сдать',
      value: formatPriceValue(getMetricValue(statPrice?.my_cash)),
      emphasize: true,
      hideDivider: true,
    },
  ], [formatPriceValue, getMetricValue, give_history, statPrice])

  const totalPriceLabel = formatPriceValue(getMetricValue(statPrice?.my_price))

  useEffect(() => {
    fetchRange(dateStart, dateEnd)
  }, [dateEnd, dateStart, fetchRange])

  return {
    activePicker,
    closePicker,
    dateEnd,
    dateStart,
    globalFontSize,
    openEndPicker,
    openStartPicker,
    pickerMaxDate,
    pickerMinDate,
    pickerTitle,
    pickerValue,
    selectPickerDate,
    settlementRows,
    showDateEnd,
    showDateStart,
    summaryRows,
    totalPriceFontSize,
    totalPriceLabel,
  }
}
