import React, { useState } from 'react'
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import YaMap from 'react-native-yamap-plus'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import {
  faLocationDot,
  faLocationPin,
  faLocationPinLock,
  faLockOpen,
  faLock,
  faRoad,
} from '@fortawesome/free-solid-svg-icons'

import { Slider, SliderThumb, SliderTrack, SliderFilledTrack } from '@/components/ui/slider'

import { TypeLimit } from './Limit';
import { ListOrders } from './ListOrders';
import { HomeMarker } from './HomeMarker';
import { ModalOrder } from './ModalOrder';
import {
  DriverMarker,
  DriverMarkerImage,
  type DriverMarkerImageSource,
} from './DriverMarker';
import { ModalFilterOrders } from './ModalFilterOrders';

const { width, height } = Dimensions.get('window')
const MAP_CONTROL_RIGHT = 20

import { useMapLogic } from '../model/useMapLogic'

import { Center } from '@/components/ui/center'
import { Spinner } from '@/components/ui/spinner'

export function MapScreen() {
  const {
    mapRef,
    zoom,
    updateZoom,
    getHome,
    home,
    set_type_location,
    type_location,
    driver_location_requesting,
    night_map,
    is_scaleMap,
    rotate_map,
    setRotateMap,
    is_showModalTypeDop,
    isOpenOrderMap,
    trafficVisible,
    toggleTrafficVisible,
    mapInitStatus,
    mapInstanceKey,
    handleMapLoaded,
    retryMap,
    shouldRenderMap,
  } = useMapLogic()
  const [hasViewport, setHasViewport] = useState(false)
  const [driverMarkerImage, setDriverMarkerImage] = useState<DriverMarkerImageSource | null>(null)

  const mtop = (height - 300) / 4

  return (
    <View
      style={[
        styles1.root,
        { backgroundColor: night_map == 1 ? '#18232D' : '#F5F5F5' },
      ]}
      testID="orders-map-screen"
    >
      { !(is_showModalTypeDop || isOpenOrderMap) && is_scaleMap == 1 &&
        <Slider
          value={zoom}
          onChange={(v) => updateZoom(v)}
          size="lg"
          orientation="vertical"
          minValue={10}
          maxValue={20}
          step={0.2}
          style={{
            position: 'absolute',
            right: MAP_CONTROL_RIGHT,
            width: 50,
            height: 300,
            top: mtop,
            zIndex: 200
          }}
        >
          <SliderTrack>
            <SliderFilledTrack />
          </SliderTrack>
          <SliderThumb />
        </Slider>
      }

      <DriverMarkerImage onImage={setDriverMarkerImage} />

      <TouchableOpacity
        accessibilityLabel={rotate_map ? 'Заблокировать поворот карты' : 'Разблокировать поворот карты'}
        accessibilityRole="button"
        style={{ backgroundColor: 'transparent', position: 'absolute', left: 10, top: 10, zIndex: 22, padding: 10 }}
        testID="orders-map-rotation-lock"
        onPress={() => setRotateMap(!rotate_map)}
      >
        <FontAwesomeIcon size={25} color={ night_map == 1 ? '#f0f8ff' : '#000' } style={{ zIndex: 22 }} icon={rotate_map === true ? faLockOpen : faLock} />
      </TouchableOpacity>

      {/* Кнопка для отображения локации водителя */}
      <TouchableOpacity
        accessibilityLabel={
          type_location === 'none'
            ? 'Показать мою геопозицию'
            : type_location === 'location'
              ? 'Включить постоянное отслеживание геопозиции'
              : 'Выключить отслеживание геопозиции'
        }
        accessibilityRole="button"
        style={{
          backgroundColor: 'transparent',
          position: 'absolute',
          right: MAP_CONTROL_RIGHT,
          top: 10,
          padding: 10,
          zIndex: 22
        }}
        testID="orders-map-driver-location"
        onPress={set_type_location}
        disabled={driver_location_requesting}
      >
        <FontAwesomeIcon 
          size={25} 
          color={night_map == 1 ? '#f0f8ff' : '#000'} 
          style={{ zIndex: 22 }} 
          icon={
            type_location === 'location'
              ? faLocationDot
              : type_location === 'watch'
                ? faLocationPin
                : faLocationPinLock
          }
          testID="orders-map-driver-location-icon"
        />
      </TouchableOpacity>

      {/* Кнопка для отображения пробок */}
      <TouchableOpacity
        style={{
          backgroundColor: 'transparent',
          position: 'absolute',
          right: MAP_CONTROL_RIGHT,
          top: 60,
          padding: 10,
          zIndex: 22
        }}
        onPress={() => toggleTrafficVisible()}
        accessibilityRole="button"
        accessibilityLabel={trafficVisible ? 'Скрыть пробки на карте' : 'Показать пробки на карте'}
        testID="orders-map-traffic"
      >
        <FontAwesomeIcon
          size={25}
          color={trafficVisible ? '#22c55e' : night_map == 1 ? '#f0f8ff' : '#000'}
          style={{ zIndex: 22 }}
          icon={faRoad}
        />
      </TouchableOpacity>

      {/* Яндекс-карта */}
      <View
        style={styles1.ymap}
        collapsable={false}
        testID="orders-map-viewport"
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout
          setHasViewport(width > 1 && height > 1)
        }}
      >
        {shouldRenderMap && hasViewport ? (
          <YaMap
            key={mapInstanceKey}
            showUserPosition={false}
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            rotateGesturesDisabled={!rotate_map}
            nightMode={night_map == 1}
            initialRegion={home ? { lat: home.lat, lon: home.lon, zoom: 12 } : undefined}
            onMapLoaded={handleMapLoaded}
            collapsable={false}
          >
            {home && <HomeMarker point={home} getHome={getHome} />}
            <DriverMarker image={driverMarkerImage} />
            <ListOrders />
          </YaMap>
        ) : (
          <Center className='w-full h-full'>
            {mapInitStatus === 'error' ? (
              <TouchableOpacity onPress={retryMap} style={{ padding: 12 }}>
                <Text style={{ fontSize: 16, color: night_map == 1 ? '#fff' : '#000' }}>
                  Карта не загрузилась. Нажмите, чтобы повторить
                </Text>
              </TouchableOpacity>
            ) : (
              <Spinner size={'large'} />
            )}
          </Center>
        )}
      </View>
      

      <TypeLimit />
      <ModalOrder />
      <ModalFilterOrders />
    </View>
  )
}

export const styles1 = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  ymap: {
    flex: 1,
    width: width,
    height: height,
  }
})
