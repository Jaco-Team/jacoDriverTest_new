import React, { useState } from 'react'
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import YaMap from 'react-native-yamap-plus'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faLocationDot, faLockOpen, faLock, faFilter, faLocationPin, faLocationPinLock, faRoad } from '@fortawesome/free-solid-svg-icons'

import { Slider, SliderThumb, SliderTrack, SliderFilledTrack } from '@/components/ui/slider'

import { TypeLimit } from './Limit';
import { ListOrders } from './ListOrders';
import { HomeMarker } from './HomeMarker';
import { ModalOrder } from './ModalOrder';
import { DriverMarker } from './DriverMarker';
import { ModalFilterOrders } from './ModalFilterOrders';

const { width, height } = Dimensions.get('window')
const MAP_CONTROL_RIGHT = 20

import { useMapLogic } from '../model/useMapLogic'

import { ScreenLayout } from '@/shared/ui/ScreenLayout'
import { Center } from '@/components/ui/center'
import { Spinner } from '@/components/ui/spinner'

export function MapScreen() {
  const { mapRef, zoom, updateZoom, getHome, home, showLocationDriver, night_map, is_scaleMap, rotate_map, setRotateMap, showModalTypeDop, is_showModalTypeDop, isActiveFilter, isOpenOrderMap, set_type_location, type_location, trafficVisible, toggleTrafficVisible, mapInitStatus, mapInstanceKey, handleMapLoaded, retryMap, shouldRenderMap } = useMapLogic()
  const [hasViewport, setHasViewport] = useState(false)

  const mtop = (height - 300) / 4

  return (
    <ScreenLayout>
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

      <TouchableOpacity style={{ backgroundColor: 'transparent', position: 'absolute', left: 10, top: 10, zIndex: 22, padding: 10 }} onPress={() => setRotateMap(!rotate_map)}>
        <FontAwesomeIcon size={25} color={ night_map == 1 ? '#f0f8ff' : '#000' } style={{ zIndex: 22 }} icon={rotate_map === true ? faLockOpen : faLock} />
      </TouchableOpacity>

      { !(is_showModalTypeDop || isOpenOrderMap) ?
        <TouchableOpacity style={{ backgroundColor: 'transparent', position: 'absolute', right: MAP_CONTROL_RIGHT, bottom: 150, zIndex: 22, padding: 10 }} onPress={() => showModalTypeDop(true)}>
          <FontAwesomeIcon size={25} color={ isActiveFilter ? '#fff44f' : night_map == 1 ? '#f0f8ff' : '#000' } style={{ zIndex: 22 }} icon={faFilter} />
        </TouchableOpacity>
          :
        false
      }

      {/* Кнопка для отображения локации водителя */}
      <TouchableOpacity
        style={{
          backgroundColor: 'transparent',
          position: 'absolute',
          right: MAP_CONTROL_RIGHT,
          top: 10,
          padding: 10,
          zIndex: 22
        }}
        onPress={() => showLocationDriver()}
        //onPress={() => set_type_location()}
      >
        <FontAwesomeIcon 
          size={25} 
          color={night_map == 1 ? '#f0f8ff' : '#000'} 
          style={{ zIndex: 22 }} 
          icon={faLocationDot} 
          //icon={type_location === 'location' ? faLocationDot : type_location === 'watch' ? faLocationPin : faLocationPinLock} 
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
            <DriverMarker />
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
    </ScreenLayout>
  )
}

export const styles1 = StyleSheet.create({
  ymap: {
    flex: 1,
    width: width,
    height: height
  }
})
