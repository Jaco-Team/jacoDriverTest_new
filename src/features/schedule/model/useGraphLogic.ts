import { useState, useEffect } from 'react'
import dayjs from 'dayjs'

import { useStatStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'

export function useGraphLogic() {
  const [getGraph] = useStatStore(
    useShallow((state) => [state.getGraph])
  )
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    // При загрузке экрана сразу подгружаем график за текущий месяц
    getGraph(dayjs().format('YYYY-MM'))
  }, [getGraph])

  // Метод, который вызывается при pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Например, можете вызвать getGraph заново:
    await getGraph(dayjs().format('YYYY-MM'))
    setIsRefreshing(false)
  }

  return {
    isRefreshing,
    handleRefresh
  }
}