import { useState, useEffect } from 'react'
import { useStatStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'
import dayjs from 'dayjs'

export function useGraphTable() {
  // Забираем нужные поля из стора
  const [dates, users, user_name] = useStatStore(
    useShallow((state) => [state.dates, state.users, state.user_name])
  )

  const [globalFontSize] = useGlobalStore(useShallow((state) => [state.globalFontSize]))

  // Локальные состояния
  const [thisDay, setThisDay] = useState('')
  const [headerDay, setHeaderDay] = useState<string[]>([])
  const [headerDow, setHeaderDow] = useState<string[]>([])

  // При первом рендере устанавливаем thisDay
  useEffect(() => {
    setThisDay(dayjs(new Date()).format('YYYY-MM-DD'))
  }, [])

  // Когда меняется dates, пересчитываем headerDay и headerDow
  useEffect(() => {
    const dayArr = dates.map((item) => item.day)
    const dowArr = dates.map((item) => item.dow)
    setHeaderDay(dayArr)
    setHeaderDow(dowArr)
  }, [dates])

  return {
    dates,
    users,
    user_name,
    thisDay,
    headerDay,
    headerDow,
    globalFontSize
  }
}