import { useEffect } from 'react'

const BACKGROUND_ORDER_REFRESH_MS = 45_000

export function useOrdersBackgroundUpdater(
  prefetchOrders: (warmAll?: boolean) => Promise<void>,
  currentCacheKey: string,
  hasCurrentCache: boolean,
  isPaused: boolean,
  isChecking: boolean,
) {
  useEffect(() => {
    if (!currentCacheKey || !hasCurrentCache || isPaused || isChecking) return
    void prefetchOrders(true)
  }, [currentCacheKey, hasCurrentCache, isChecking, isPaused, prefetchOrders])

  useEffect(() => {
    const id = setInterval(() => {
      void prefetchOrders(false)
    }, BACKGROUND_ORDER_REFRESH_MS)

    return () => clearInterval(id)
  }, [prefetchOrders])
}
