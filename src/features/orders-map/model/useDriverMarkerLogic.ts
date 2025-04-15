import { useShallow } from 'zustand/react/shallow'
import { useGEOStore, useGlobalStore } from '@/shared/store/store'

export function useDriverMarkerLogic() {
  const [location_driver, location_driver_time_text] = useGEOStore(
    useShallow((state) => [state.location_driver, state.location_driver_time_text])
  )
  const [globalFontSize, mapScale, theme] = useGlobalStore(
    useShallow((state) => [state.globalFontSize, state.mapScale, state.theme])
  )

  return {
    location_driver,
    location_driver_time_text,
    globalFontSize,
    mapScale,
    theme
  }
}
