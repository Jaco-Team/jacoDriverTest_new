import { useEffect } from 'react'

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
}
