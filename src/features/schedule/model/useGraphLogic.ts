import { useEffect } from 'react'
import dayjs from 'dayjs'

import { useStatStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'

export function useGraphLogic() {
  const [getGraph] = useStatStore(
    useShallow((state) => [state.getGraph])
  )
  useEffect(() => {
    getGraph(dayjs().format('YYYY-MM'))
  }, [getGraph])

  return null
}
