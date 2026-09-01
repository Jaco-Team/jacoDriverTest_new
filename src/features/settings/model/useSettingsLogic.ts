import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useGlobalStore, useSettingsStore } from '@/shared/store/store'
import { DelType, ShowType, Theme } from '@/shared/types/globalTypes'

function normalizeNumber(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeFlag(value: unknown): boolean {
  return Number(value) === 1 || value === true
}

export function useSettingsLogic() {
  const settings = useSettingsStore(
    useShallow(state => ({
      getSettings: state.getSettings,
      saveSettings: state.saveSettings,
      isSaving: state.isClick,
      actionCenteredMap: state.action_centered_map,
      color: state.color,
      fontSize: state.fontSize,
      mapScale: state.mapScale,
      theme: state.theme,
      typeDataMap: state.type_data_map,
      typeShowDel: state.type_show_del,
      updateInterval: state.update_interval,
      nightMap: state.night_map,
      isScaleMap: state.is_scaleMap,
    })),
  )
  const {
    getSettings,
    saveSettings: persistSettings,
    isSaving,
    actionCenteredMap,
    color: storedColor,
    fontSize: storedFontSize,
    mapScale: storedMapScale,
    theme: storedTheme,
    typeDataMap,
    typeShowDel: storedTypeShowDel,
    updateInterval: storedUpdateInterval,
    nightMap: storedNightMap,
    isScaleMap,
  } = settings
  const globalFontSize = useGlobalStore(state => state.globalFontSize)

  const [typeShowDel, setTypeShowDel] = useState<DelType>(storedTypeShowDel)
  const [centeredMap, setCenteredMap] = useState(normalizeFlag(actionCenteredMap))
  const [nightMap, setNightMap] = useState(normalizeFlag(storedNightMap))
  const [showMapScale, setShowMapScale] = useState(normalizeFlag(isScaleMap))
  const [fontSize, setFontSize] = useState(normalizeNumber(storedFontSize, 16))
  const [updateInterval, setUpdateInterval] = useState(normalizeNumber(storedUpdateInterval, 30))
  const [color, setColor] = useState(storedColor || '#000000')
  const [isColorPickerActive, setIsColorPickerActive] = useState(false)
  const [mapDataType, setMapDataType] = useState<ShowType>(typeDataMap)
  const [markerTheme, setMarkerTheme] = useState<Theme>(storedTheme)
  const [mapScale, setMapScale] = useState(normalizeNumber(storedMapScale, 1))

  useEffect(() => {
    void getSettings()
  }, [getSettings])

  useEffect(() => {
    setTypeShowDel(storedTypeShowDel)
    setCenteredMap(normalizeFlag(actionCenteredMap))
    setNightMap(normalizeFlag(storedNightMap))
    setShowMapScale(normalizeFlag(isScaleMap))
    setFontSize(normalizeNumber(storedFontSize, 16))
    setUpdateInterval(normalizeNumber(storedUpdateInterval, 30))
    setColor(storedColor || '#000000')
    setMapDataType(typeDataMap)
    setMarkerTheme(storedTheme)
    setMapScale(normalizeNumber(storedMapScale, 1))
  }, [
    actionCenteredMap,
    isScaleMap,
    storedColor,
    storedFontSize,
    storedMapScale,
    storedNightMap,
    storedTheme,
    storedTypeShowDel,
    storedUpdateInterval,
    typeDataMap,
  ])

  const saveSettings = async () => {
    await persistSettings(
      typeShowDel,
      centeredMap ? ['is_center'] : [],
      fontSize,
      updateInterval,
      color,
      mapScale,
      mapDataType,
      markerTheme,
      nightMap ? ['is_night'] : [],
      showMapScale ? ['is_scaleMap'] : [],
    )
  }

  return {
    globalFontSize,
    typeShowDel,
    setTypeShowDel,
    centeredMap,
    setCenteredMap,
    fontSize,
    setFontSize,
    updateInterval,
    setUpdateInterval,
    color,
    setColor,
    isColorPickerActive,
    setIsColorPickerActive,
    mapDataType,
    setMapDataType,
    markerTheme,
    setMarkerTheme,
    mapScale,
    setMapScale,
    nightMap,
    setNightMap,
    showMapScale,
    setShowMapScale,
    isSaving,
    saveSettings,
  }
}
