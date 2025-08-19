import { useState, useEffect } from 'react'
import { useStatStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'
import dayjs, { ConfigType } from 'dayjs'

export function usePriceScreen() {
  const [globalFontSize] = useGlobalStore(useShallow((state) => [state.globalFontSize]))

  const [getStatBetween, statPrice, give_history, FormatPrice, FormatDate] = useStatStore(
    useShallow((state) => [
      state.getStatBetween,
      state.statPrice,
      state.give_history,
      state.FormatPrice,
      state.FormatDate
    ])
  )

  const todayIso = dayjs().format('YYYY-MM-DD')

  const [dateStart, setDateStart] = useState<string>(todayIso)
  const [dateEnd, setDateEnd] = useState<string>(todayIso)

  const [showDateStart, setShowDateStart] = useState<string>(FormatDate(new Date()))
  const [showDateEnd, setShowDateEnd] = useState<string>(FormatDate(new Date()))

  const [showStartCalendar, setShowStartCalendar] = useState<boolean>(false)
  const [showEndCalendar, setShowEndCalendar] = useState<boolean>(false)

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  const fetchRange = (start: string, end: string) => {
    getStatBetween(start, end)
  }

  const chooseStartDate = (data: ConfigType) => {
    const newStart = dayjs(data).format('YYYY-MM-DD')
    const endSafe = dayjs(newStart).isAfter(dateEnd) ? newStart : dateEnd

    setDateStart(newStart)
    setDateEnd(endSafe)

    setShowDateStart(FormatDate(data))
    if (endSafe === newStart) setShowDateEnd(FormatDate(data))

    fetchRange(newStart, endSafe)
  }

  const chooseEndDate = (data: ConfigType) => {
    const newEnd = dayjs(data).format('YYYY-MM-DD')
    const startSafe = dayjs(newEnd).isBefore(dateStart) ? newEnd : dateStart

    setDateEnd(newEnd)
    setDateStart(startSafe)

    setShowDateEnd(FormatDate(data))
    if (startSafe === newEnd) setShowDateStart(FormatDate(data))

    fetchRange(startSafe, newEnd)
  }

  const refresh = async () => {
    setIsRefreshing(true)
    fetchRange(dateStart, dateEnd)
    setIsRefreshing(false)
  }

  useEffect(() => {
    fetchRange(dateStart, dateEnd)
  }, [])

  return {
    statPrice,
    give_history,
    FormatPrice,
    globalFontSize,
    dateStart,
    dateEnd,
    showDateStart,
    showDateEnd,
    showStartCalendar,
    setShowStartCalendar,
    showEndCalendar,
    setShowEndCalendar,
    chooseStartDate,
    chooseEndDate,
    refresh,
    isRefreshing,
    setIsRefreshing,
  }
}
