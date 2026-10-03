import { useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'

import { isAppOffline } from './connectivityState'

const RETRY_DELAY_MS = 10000

/** Refresh only the focused online screen; retry transient failures without navigation or reload. */
export function useOnlineScreenRefresh(
  isOffline: boolean,
  request: () => Promise<boolean>,
): void {
  useFocusEffect(useCallback(() => {
    if (isOffline) return

    let active = true
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const run = async () => {
      if (!active || isAppOffline()) return

      let settled = true
      try {
        settled = await request()
      } catch {
        settled = false
      }

      if (active && !settled && !isAppOffline()) {
        retryTimer = setTimeout(() => void run(), RETRY_DELAY_MS)
      }
    }

    void run()

    return () => {
      active = false
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [isOffline, request]))
}
