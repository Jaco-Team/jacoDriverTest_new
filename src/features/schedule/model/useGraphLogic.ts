import { useCallback } from 'react'
import dayjs from 'dayjs'

import { useStatStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'
import {useIsOffline} from '@/shared/ui/ConnectivityLocationIndicator'
import {useOnlineScreenRefresh} from '@/shared/lib/useOnlineScreenRefresh'

export function useGraphLogic() {
  const isOffline = useIsOffline()
  const [getGraph] = useStatStore(
    useShallow((state) => [state.getGraph])
  )
  const refreshGraph = useCallback(
    () => getGraph(useStatStore.getState().dateGraph || dayjs().format('YYYY-MM')),
    [getGraph],
  )
  useOnlineScreenRefresh(isOffline, refreshGraph)

  return null
}
