import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useFocusEffect, useIsFocused } from '@react-navigation/native'
import { useShallow } from 'zustand/react/shallow'

import YaMap, { Animation } from 'react-native-yamap-plus'

import { useOrdersStore, useGEOStore, useSettingsStore } from '@/shared/store/store'
import { initYaMap } from '@/shared/lib/yaMapInit'

import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';

const MAP_LOAD_RETRY_MS = 2500

function scheduleAfterInteractions(cb: () => void): () => void {
  const g = globalThis as typeof globalThis & {
    requestIdleCallback?: (callback: () => void) => number
    cancelIdleCallback?: (handle: number) => void
  }

  if (typeof g.requestIdleCallback === 'function') {
    const id = g.requestIdleCallback(cb)
    return () => g.cancelIdleCallback?.(id)
  }

  const id = setTimeout(cb, 0)
  return () => clearTimeout(id)
}

export function useMapLogic() {
  const mapRef = useRef<React.ElementRef<typeof YaMap>>(null)
  const didAutoRemountRef = useRef(false)
  const didCenterOnLoadRef = useRef(false)
  const [zoom, setZoom] = useState<number>(12)
  const [trafficVisible, setTrafficVisible] = useState<boolean>(false)
  const [mapInitStatus, setMapInitStatus] = useState<'pending' | 'ready' | 'error'>('pending')
  const [isMapMounted, setMapMounted] = useState(false)
  const [isMapLoaded, setMapLoaded] = useState(false)
  const [mapInstanceKey, setMapInstanceKey] = useState(0)

  const [ getSettings, night_map, is_scaleMap, rotate_map, setRotateMap ] = useSettingsStore( useShallow( state => [ state.getSettings, state.night_map, state.is_scaleMap, state.rotate_map, state.setRotateMap ] ) )

  const [getOrders, home, update_interval, is_showModalTypeDop, isOpenOrderMap, mapHomeCenterRequestId ] = useOrdersStore(
    useShallow((state) => [
      state.getOrders,
      state.home,
      state.update_interval,
      state.is_showModalTypeDop,
      state.isOpenOrderMap,
      state.mapHomeCenterRequestId
    ])
  );

  const [ showLocationDriver, set_type_location, type_location ] = useGEOStore( useShallow( state => [ state.showLocationDriver, state.set_type_location, state.type_location ] ) )

  const isFocused = useIsFocused();

  useEffect(() => {
    let cancelled = false

    initYaMap().then((ok) => {
      if (cancelled) return
      setMapInitStatus(ok ? 'ready' : 'error')
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Метод для центрирования на «home»
  const getHome = useCallback(() => {
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
  }, [home])

  const handleMapLoaded = useCallback(() => {
    setMapLoaded(true)
    if (!didCenterOnLoadRef.current) {
      didCenterOnLoadRef.current = true
      getHome()
    }
  }, [getHome])

  useEffect(() => {
    if (!mapHomeCenterRequestId) return
    getHome()
    // только явный запрос после взятия/отмены, не каждый новый объект home с сервера
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapHomeCenterRequestId])

  const remountMap = useCallback(() => {
    didCenterOnLoadRef.current = false
    setMapLoaded(false)
    setMapInstanceKey((key) => key + 1)
  }, [])

  const retryMap = useCallback(() => {
    didAutoRemountRef.current = false
    setMapLoaded(false)
    setMapInitStatus('pending')

    initYaMap({ force: true }).then((ok) => {
      setMapInitStatus(ok ? 'ready' : 'error')
      if (ok) {
        remountMap()
      }
    })
  }, [remountMap])

  // ✅ 1) Один раз на вход в экран (на фокус), без завязки на update_interval
  useFocusEffect(
    useCallback(() => {
      let cancelled = false

      getOrders();
      getSettings();
      setMapLoaded(false)
      didAutoRemountRef.current = false
      didCenterOnLoadRef.current = false
      setMapMounted(false)

      const mountMap = () => {
        if (!cancelled) {
          setMapMounted(true)
        }
      }

      const cancelSchedule = scheduleAfterInteractions(mountMap)

      return () => {
        cancelled = true
        cancelSchedule()
        setMapMounted(false)
      };
    }, [getOrders, getSettings])
  );

  // ✅ 2) Отдельно — только интервал автообновления
  useEffect(() => {
    if (!isFocused) return;
    const ms = Number(update_interval) * 1000;
    if (ms <= 0) return;

    const id = setInterval(() => getOrders(false), ms);
    return () => clearInterval(id);
  }, [isFocused, update_interval, getOrders]);

  useEffect(() => {
    if (!isFocused || mapInitStatus !== 'ready' || !isMapMounted || isMapLoaded || didAutoRemountRef.current) {
      return
    }

    const id = setTimeout(() => {
      didAutoRemountRef.current = true
      remountMap()
    }, MAP_LOAD_RETRY_MS)

    return () => clearTimeout(id)
  }, [isFocused, isMapLoaded, isMapMounted, mapInitStatus, mapInstanceKey, remountMap])

  // Метод для установки зума
  const updateZoom = async (value: number) => {
    setZoom(value)
    if (mapRef.current) {
      mapRef.current.setZoom(value, 0, Animation.SMOOTH)
    }
  }

  // Метод для отображения/скрытия пробок
  const toggleTrafficVisible = () => {
    setTrafficVisible((prev) => {
      const nextValue = !prev
      mapRef.current?.setTrafficVisible(nextValue)
      return nextValue
    })
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
    is_showModalTypeDop,
    isOpenOrderMap,
    set_type_location,
    type_location,
    trafficVisible,
    toggleTrafficVisible,
    mapInitStatus,
    isMapMounted,
    isMapLoaded,
    mapInstanceKey,
    handleMapLoaded,
    retryMap,
    shouldRenderMap: isFocused && mapInitStatus === 'ready' && isMapMounted
  }
}
