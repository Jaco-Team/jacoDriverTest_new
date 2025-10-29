import { useState, useEffect } from 'react'
import dayjs, { ConfigType } from 'dayjs'
import { useStatStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'
import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';

const MAX_SPAN_DAYS = 93;

type ClampReason =
  | 'afterToday'          // дата позже сегодня
  | 'beforeMin'           // дата раньше доступного минимума
  | 'endBeforeStart'      // конец раньше начала
  | 'spanTooLong'         // диапазон > MAX_SPAN_DAYS
  | 'spanTrimmedByToday'  // конец подрезан до сегодня
  | 'spanTrimmedByMin';   // начало подрезано до minDate

export function useStatisticsTable() {
  const [getStatistics, statArr] = useStatStore(
    useShallow((state) => [state.getStatistics, state.statArr])
  )

  const [globalFontSize, showAlertText] = useGlobalStore(useShallow((state) => [state.globalFontSize, state.showAlertText]))

  // граничные даты
  const today = dayjs().startOf('day');
  const minDate = today.subtract(MAX_SPAN_DAYS, 'day');

  // форматтер
  const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');

  const [dateStart, setDateStart] = useState(dayjs().format('YYYY-MM-DD'))
  const [dateEnd, setDateEnd] = useState(dayjs().format('YYYY-MM-DD'))

  const [showCalendarStart, setShowCalendarStart] = useState(false)
  const [showCalendarEnd, setShowCalendarEnd] = useState(false)

  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    getStatistics(dateStart, dateEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // нормализуем выбранный диапазон и собираем причины корректировок
  const normalizeRangeWithReasons = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
    let s = start
    let e = end
    const reasons: ClampReason[] = []

    // clamp по границам
    if (s.isAfter(today)) {
      s = today
      reasons.push('afterToday')
    }
    if (s.isBefore(minDate)) {
      s = minDate
      reasons.push('beforeMin')
    }
    if (e.isAfter(today)) {
      e = today
      reasons.push('spanTrimmedByToday')
    }
    if (e.isBefore(minDate)) {
      e = minDate
      reasons.push('spanTrimmedByMin')
    }

    // не даём инвертировать
    if (e.isBefore(s)) {
      e = s
      reasons.push('endBeforeStart')
    }

    // ограничение по длине
    const span = e.diff(s, 'day')
    if (span > MAX_SPAN_DAYS) {
      e = s.add(MAX_SPAN_DAYS, 'day')
      reasons.push('spanTooLong')
      // на случай выхода за today после подрезания
      if (e.isAfter(today)) {
        e = today
        s = e.subtract(MAX_SPAN_DAYS, 'day')
        // пометим дополнительную причину в зависимости от того, что подрезали
        if (e.isSame(today)) reasons.push('spanTrimmedByToday')
        if (s.isSame(minDate)) reasons.push('spanTrimmedByMin')
      }
    }

    return { s, e, reasons }
  }

  // формируем сообщение по причинам корректировок
  const reasonsToMessage = (reasons: ClampReason[], s: dayjs.Dayjs, e: dayjs.Dayjs) => {
    if (!reasons.length) return null

    const parts: string[] = []
    if (reasons.includes('afterToday')) parts.push('Дата “от” не может быть позже сегодняшней.')
    if (reasons.includes('beforeMin')) parts.push(`Дата “от” не может быть раньше ${fmt(minDate)}.`)
    if (reasons.includes('endBeforeStart')) parts.push('Дата “до” не может быть раньше “от”.')
    if (reasons.includes('spanTooLong')) parts.push(`Диапазон не может превышать ${MAX_SPAN_DAYS} дней.`)
    if (reasons.includes('spanTrimmedByToday')) parts.push('Дата “до” ограничена сегодняшним днём.')
    if (reasons.includes('spanTrimmedByMin')) parts.push(`Дата “от” ограничена ${fmt(minDate)}.`)

    const finalRange = `Выбран период: ${fmt(s)} — ${fmt(e)}`
    return `${parts.join(' ')} ${finalRange}`
  }

  // показываем алерт с сообщением о корректировках
  const showAdjustmentIfAny = (reasons: ClampReason[], s: dayjs.Dayjs, e: dayjs.Dayjs) => {
    const msg = reasonsToMessage(reasons, s, e)
    if (msg) {
      showAlertText(true, msg);
    }
  }
  
  // обработчики выбора первой даты
  const chooseDateStart = (data: ConfigType) => {
    Analytics.log(AnalyticsEvent.StatisticsCalendarStartClose, 'Закрытие календаря (Статистика времени): Дата от');
    Analytics.log(AnalyticsEvent.StatisticsDateSelected, 'Выбор даты (Статистика времени)');

    setShowCalendarStart(false);

    const picked = dayjs(data).startOf('day');
    const currentEnd = dayjs(dateEnd, 'YYYY-MM-DD');
    const { s, e, reasons } = normalizeRangeWithReasons(picked, currentEnd);

    setDateStart(fmt(s));
    setDateEnd(fmt(e));
    showAdjustmentIfAny(reasons, s, e)
    getStatistics(fmt(s), fmt(e));
  }

  // обработчики выбора второй даты
  const chooseDateEnd = (data: ConfigType) => {
    Analytics.log(AnalyticsEvent.StatisticsCalendarEndClose, 'Закрытие календаря (Статистика времени): Дата до');
    Analytics.log(AnalyticsEvent.StatisticsDateSelected, 'Выбор даты (Статистика времени)');

    setShowCalendarEnd(false);

    const picked = dayjs(data).startOf('day');
    const currentStart = dayjs(dateStart, 'YYYY-MM-DD');
    const { s, e, reasons } = normalizeRangeWithReasons(currentStart, picked);

    setDateStart(fmt(s));
    setDateEnd(fmt(e));
    showAdjustmentIfAny(reasons, s, e);
    getStatistics(fmt(s), fmt(e));
  }

  // обработчик обновления
  const onRefresh = () => {
    setIsRefreshing(true)
    getStatistics(dateStart, dateEnd)
    setTimeout(() => setIsRefreshing(false), 500) // или await если fetch
  }

  return {
    statArr,
    dateStart,
    dateEnd,
    showCalendarStart,
    setShowCalendarStart,
    showCalendarEnd,
    setShowCalendarEnd,
    isRefreshing,
    onRefresh,
    chooseDateStart,
    chooseDateEnd,
    globalFontSize
  }
}
