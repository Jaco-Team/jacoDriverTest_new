import { useState, useEffect } from 'react'
import { useStatStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'
import dayjs, { ConfigType } from 'dayjs'

export function usePriceScreen() {
  const [globalFontSize] = useGlobalStore(useShallow((state) => [state.globalFontSize]))

  const [getStatPrice, statPrice, give_history, FormatPrice, FormatDate] = useStatStore(
    useShallow((state) => [
      state.getStatPrice,
      state.statPrice,
      state.give_history,
      state.FormatPrice,
      state.FormatDate
    ])
  )

  const [date, setDate] = useState(dayjs(new Date()).format('YYYY-MM-DD'))
  const [showDate, setShowDate] = useState( FormatDate( new Date() ) )
  const [showCalendar, setShowCalendar] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const chooseDate = (data: ConfigType) => {
    setShowCalendar(false)
    const newDate = dayjs(data).format('YYYY-MM-DD')
    setDate( newDate )
    setShowDate( FormatDate( data ) )
    getStatPrice(newDate)
  }

  useEffect(() => {
    getStatPrice(date)
  }, [])

  return {
    statPrice,
    give_history,
    FormatPrice,
    date,
    showDate,
    setDate,
    showCalendar,
    setShowCalendar,
    isRefreshing,
    setIsRefreshing,
    chooseDate,
    globalFontSize
  }
}