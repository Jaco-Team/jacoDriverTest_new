import { useState, useEffect } from 'react'

import {
  Platform,
  Linking
} from 'react-native'

import { useSettingsStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'
import { Theme, DelType, ShowType } from '@/shared/types/globalTypes'

export function useSettingsLogic() {
  // Достаём методы/значения из zustand
  const [
    getSettings,
    saveSettings,
    action_centered_map,
    color,
    fontSize,
    mapScale,
    theme,
    type_data_map,
    type_show_del,
    update_interval,
    night_map,
    is_scaleMap
  ] = useSettingsStore(
    useShallow((state) => [
      state.getSettings,
      state.saveSettings,
      state.action_centered_map,
      state.color,
      state.fontSize,
      state.mapScale,
      state.theme,
      state.type_data_map,
      state.type_show_del,
      state.update_interval,
      state.night_map,
      state.is_scaleMap
    ])
  )

  // Глобальный размер шрифта
  const [globalFontSize] = useGlobalStore(
    useShallow((state) => [state.globalFontSize])
  )

  // Локальные стейты
  const [type_show_delState, setType_show_del] = useState<DelType>(type_show_del)
  const [centered_mapState, setCentered_map] = useState<['is_center'] | []>(
    action_centered_map === 1 ? ['is_center'] : []
  )
  const [night_mapState, setNight_map] = useState<['is_night'] | []>(
    night_map === 1 ? ['is_night'] : []
  )
  const [is_scaleMapState, setScale_map] = useState<['is_scaleMap'] | []>(
    is_scaleMap === 1 ? ['is_scaleMap'] : []
  )
  const [fontSizeState, setFontSize] = useState<number>(parseInt(fontSize))
  const [update_intervalState, setUpdate_interval] = useState<number>(update_interval)
  const [colorState, setColor] = useState<string>(color)
  const [swatchesLoadingState, setSwatchesLoading] = useState<boolean>(false)
  const [groupTypeTimeState, setGroupTypeTime] = useState<ShowType>(type_data_map)
  const [groupTypeThemeState, setGroupTypeTheme] = useState<Theme>(theme)
  const [mapScaleState, setMapScale] = useState<number>(parseFloat(mapScale))
  

  // При первом рендере
  useEffect(() => {
    getSettings()
  }, [getSettings])

  // Обновляем локальные стейты, если в zustand что-то поменялось
  useEffect(() => {

    setType_show_del(type_show_del)
    setCentered_map(action_centered_map == 1 ? ['is_center'] : [])

    setNight_map(night_map == 1 ? ['is_night'] : [])
    setScale_map(is_scaleMap == 1 ? ['is_scaleMap'] : [])

    setFontSize(parseInt(fontSize))
    setUpdate_interval(update_interval)
    setColor(color)
    setGroupTypeTime(type_data_map)
    setGroupTypeTheme(theme)
    setMapScale(parseFloat(mapScale))
  }, [
    action_centered_map,
    color,
    fontSize,
    mapScale,
    theme,
    type_data_map,
    type_show_del,
    update_interval,
    night_map,
    is_scaleMap
  ])

  // Сохранение настроек
  const saveSettingsFunc = () => {
    saveSettings(
      type_show_delState,
      centered_mapState,
      fontSizeState,
      update_intervalState,
      colorState,
      mapScaleState,
      groupTypeTimeState,
      groupTypeThemeState,
      night_mapState,
      is_scaleMapState
    )
  }

  // Открыть настройки приложения
  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings://')
    } else {
      Linking.openSettings()
    }
  }

  return {
    // Глобальные
    globalFontSize,

    // Локальные
    type_show_delState,
    setType_show_del,
    centered_mapState,
    setCentered_map,
    fontSizeState,
    setFontSize,
    update_intervalState,
    setUpdate_interval,
    colorState,
    setColor,
    swatchesLoadingState,
    setSwatchesLoading,
    groupTypeTimeState,
    setGroupTypeTime,
    groupTypeThemeState,
    setGroupTypeTheme,
    mapScaleState,
    setMapScale,
    night_mapState, 
    setNight_map,
    setScale_map,
    is_scaleMapState,

    // Методы
    saveSettingsFunc,
    openSettings
  }
}