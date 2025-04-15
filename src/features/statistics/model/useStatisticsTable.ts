import { useState, useEffect } from 'react'
import dayjs, { ConfigType } from 'dayjs'
import { useStatStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'

export function useStatisticsTable() {
  const [getStatistics, statArr] = useStatStore(
    useShallow((state) => [state.getStatistics, state.statArr])
  )

  const [dateStart, setDateStart] = useState(dayjs().format('YYYY-MM-DD'))
  const [dateEnd, setDateEnd] = useState(dayjs().format('YYYY-MM-DD'))

  const [showCalendarStart, setShowCalendarStart] = useState(false)
  const [showCalendarEnd, setShowCalendarEnd] = useState(false)

  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    getStatistics(dateStart, dateEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chooseDateStart = (data: ConfigType) => {
    setShowCalendarStart(false)
    const newDate = dayjs(data).format('YYYY-MM-DD')
    setDateStart(newDate)
    getStatistics(newDate, dateEnd)
  }

  const chooseDateEnd = (data: ConfigType) => {
    setShowCalendarEnd(false)
    const newDate = dayjs(data).format('YYYY-MM-DD')
    setDateEnd(newDate)
    getStatistics(dateStart, newDate)
  }

  const onRefresh = () => {
    setIsRefreshing(true)
    getStatistics(dateStart, dateEnd)
    setTimeout(() => setIsRefreshing(false), 500) // или await если fetch
  }

  const [globalFontSize] = useGlobalStore(useShallow((state) => [state.globalFontSize]))

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