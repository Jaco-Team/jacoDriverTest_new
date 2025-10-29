import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useFocusEffect, useIsFocused } from '@react-navigation/native'
import { useShallow } from 'zustand/react/shallow'

import YaMap, { Animation } from 'react-native-yamap'

import { useOrdersStore, useGEOStore, useSettingsStore } from '@/shared/store/store'

import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';

export function useMapLogic() {
  const mapRef = useRef<YaMap>(null)
  const [zoom, setZoom] = useState<number>(12)
  const [isActiveFilter, setActiveFilter] = useState<boolean>(false);

  const [ getSettings, night_map, is_scaleMap, rotate_map, setRotateMap ] = useSettingsStore( useShallow( state => [ state.getSettings, state.night_map, state.is_scaleMap, state.rotate_map, state.setRotateMap ] ) )

  const [getOrders, home, update_interval, showModalTypeDop, is_showModalTypeDop, types_dop, type_dop, isOpenOrderMap ] = useOrdersStore(
    useShallow((state) => [
      state.getOrders,
      state.home,
      state.update_interval,
      state.showModalTypeDop,
      state.is_showModalTypeDop,
      state.types_dop,
      state.type_dop,
      state.isOpenOrderMap
    ])
  );

  useEffect(() => {
    setActiveFilter( types_dop.length != type_dop.length )
  }, [types_dop, type_dop])

  const [ showLocationDriver, set_type_location, type_location ] = useGEOStore( useShallow( state => [ state.showLocationDriver, state.set_type_location, state.type_location ] ) )

  const isFocused = useIsFocused();

  // ✅ 1) Один раз на вход в экран (на фокус), без завязки на update_interval
  useFocusEffect(
    useCallback(() => {
      getOrders();
      getHome();
      getSettings();
      return () => {};
    }, []) // <-- без зависимостей
  );

  // ✅ 2) Отдельно — только интервал автообновления
  useEffect(() => {
    if (!isFocused) return;
    const ms = Number(update_interval) * 1000;
    if (ms <= 0) return;

    const id = setInterval(() => getOrders(false), ms);
    return () => clearInterval(id);
  }, [isFocused, update_interval, getOrders]);

  // Метод для установки зума
  const updateZoom = async (value: number) => {
    setZoom(value)
    if (mapRef.current) {
      mapRef.current.setZoom(value, 0, Animation.SMOOTH)
    }
  }

  // Метод для центрирования на «home»
  const getHome = () => {
    Analytics.log(AnalyticsEvent.MapHomeCenter, 'Центрирование карты на домашнюю точку');
    if (mapRef.current && home) {
      mapRef.current.setCenter(
        { lon: home.lon, lat: home.lat },
        12,
        0,
        0,
        0,
        Animation.SMOOTH
      )
    }
  }

  return {
    mapRef,
    zoom,
    updateZoom,
    getHome,
    home,
    showLocationDriver,
    night_map, 
    is_scaleMap,
    rotate_map, 
    setRotateMap,
    showModalTypeDop,
    is_showModalTypeDop,
    isActiveFilter,
    isOpenOrderMap,
    set_type_location,
    type_location
  }
}
