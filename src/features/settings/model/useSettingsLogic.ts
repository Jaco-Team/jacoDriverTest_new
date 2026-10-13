import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useShallow } from 'zustand/react/shallow'

import { useGlobalStore, useLoginStore, useSettingsStore } from '@/shared/store/store'
import { DelType, ShowType, Theme } from '@/shared/types/globalTypes'
import {
  useAppTheme,
  type AppThemePreference,
} from '@/shared/theme/AppThemeProvider'
import {useIsOffline} from '@/shared/ui/ConnectivityLocationIndicator'
import {useOrderRecommendationStore} from '@/features/order-recommendation/model/orderRecommendation.store'

function normalizeNumber(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeFlag(value: unknown): boolean {
  return Number(value) === 1 || value === true
}

export function useSettingsLogic() {
  const isOffline = useIsOffline()
  const {
    preference: storedAppThemePreference,
    deviceScheme,
    setPreviewPreference,
    clearPreviewPreference,
  } = useAppTheme()
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
      isScaleMap: state.is_scaleMap,
      mapHints: state.map_hints,
      aiRecommend: state.ai_recommend,
      points: state.points,
      pointId: state.point_id,
      setPointId: state.setPointId,
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
    isScaleMap,
    mapHints: storedMapHints,
    aiRecommend: storedAiRecommend,
    points,
    pointId,
    setPointId,
  } = settings
  const globalFontSize = useGlobalStore(state => state.globalFontSize)
  const showAlertText = useGlobalStore(state => state.showAlertText)
  const currentUser = useLoginStore(state => state.currentUser)
  const logogout = useLoginStore(state => state.logogout)
  const isDemoAccount = currentUser?.login?.trim() === '79990000001'

  const [typeShowDel, setTypeShowDel] = useState<DelType>(storedTypeShowDel)
  const [centeredMap, setCenteredMap] = useState(normalizeFlag(actionCenteredMap))
  const [appThemePreference, setAppThemePreference] = useState<AppThemePreference>(
    storedAppThemePreference,
  )
  const [showMapScale, setShowMapScale] = useState(normalizeFlag(isScaleMap))
  const [showMapHints, setShowMapHints] = useState(normalizeFlag(storedMapHints))
  const [aiRecommend, setAiRecommend] = useState(normalizeFlag(storedAiRecommend))
  const [fontSize, setFontSize] = useState(normalizeNumber(storedFontSize, 16))
  const [updateInterval, setUpdateInterval] = useState(normalizeNumber(storedUpdateInterval, 30))
  const [color, setColor] = useState(storedColor || '#000000')
  const [isColorPickerActive, setIsColorPickerActive] = useState(false)
  const [mapDataType, setMapDataType] = useState<ShowType>(typeDataMap)
  const [markerTheme, setMarkerTheme] = useState<Theme>(storedTheme)
  const [mapScale, setMapScale] = useState(normalizeNumber(storedMapScale, 1))

  useFocusEffect(
    useCallback(() => {
      if (!isOffline) void getSettings()
    }, [getSettings, isOffline]),
  )

  useFocusEffect(
    useCallback(() => () => clearPreviewPreference(), [clearPreviewPreference]),
  )

  useEffect(() => {
    setTypeShowDel(storedTypeShowDel)
    setCenteredMap(normalizeFlag(actionCenteredMap))
    setShowMapScale(normalizeFlag(isScaleMap))
    setShowMapHints(normalizeFlag(storedMapHints))
    setAiRecommend(normalizeFlag(storedAiRecommend))
    setFontSize(normalizeNumber(storedFontSize, 16))
    setUpdateInterval(normalizeNumber(storedUpdateInterval, 30))
    setColor(storedColor || '#000000')
    setMapDataType(typeDataMap)
    setMarkerTheme(storedTheme)
    setMapScale(normalizeNumber(storedMapScale, 1))
  }, [
    actionCenteredMap,
    isScaleMap,
    storedMapHints,
    storedAiRecommend,
    storedColor,
    storedFontSize,
    storedMapScale,
    storedTheme,
    storedTypeShowDel,
    storedUpdateInterval,
    typeDataMap,
  ])

  useEffect(() => {
    setAppThemePreference(storedAppThemePreference)
  }, [storedAppThemePreference])

  const selectAppThemePreference = (preference: AppThemePreference) => {
    setAppThemePreference(preference)
    setPreviewPreference(preference)
  }

  const saveSettings = async () => {
    const useDarkMap = appThemePreference === 'dark'
      || (appThemePreference === 'system' && deviceScheme === 'dark')

    await persistSettings(
      typeShowDel,
      centeredMap ? ['is_center'] : [],
      fontSize,
      updateInterval,
      color,
      mapScale,
      mapDataType,
      markerTheme,
      useDarkMap ? ['is_night'] : [],
      showMapScale ? ['is_scaleMap'] : [],
      appThemePreference,
      showMapHints,
      aiRecommend,
    )

    if (Number(useSettingsStore.getState().ai_recommend) !== 1) {
      useOrderRecommendationStore.getState().reset()
    }
  }

  const deleteDemoAccount = async (): Promise<boolean> => {
    if (!isDemoAccount) {
      return false
    }

    await logogout()
    showAlertText(true, 'Аккаунт удалён')
    return true
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
    appThemePreference,
    setAppThemePreference: selectAppThemePreference,
    showMapScale,
    setShowMapScale,
    showMapHints,
    setShowMapHints,
    aiRecommend,
    setAiRecommend,
    isSaving,
    saveSettings,
    points,
    pointId,
    setPointId,
    isDemoAccount,
    deleteDemoAccount,
  }
}
