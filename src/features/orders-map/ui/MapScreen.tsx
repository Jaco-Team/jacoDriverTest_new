import React from 'react'
import { Dimensions, StyleSheet, TouchableOpacity } from 'react-native'

import YaMap from 'react-native-yamap'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faLocationDot, faLockOpen, faLock, faFilter, faLocationPin, faLocationPinLock } from '@fortawesome/free-solid-svg-icons'

import { Slider, SliderThumb, SliderTrack, SliderFilledTrack } from '@/components/ui/slider'

import { TypeLimit } from './Limit';
import { ListOrders } from './ListOrders';
import { HomeMarker } from './HomeMarker';
import { ModalOrder } from './ModalOrder';
import { DriverMarker } from './DriverMarker';
import { ModalFilterOrders } from './ModalFilterOrders';

const { width, height } = Dimensions.get('window')

import { useMapLogic } from '../model/useMapLogic'

import { ScreenLayout } from '@/shared/ui/ScreenLayout'

export function MapScreen() {
  const { mapRef, zoom, updateZoom, getHome, home, showLocationDriver, night_map, is_scaleMap, rotate_map, setRotateMap, showModalTypeDop, is_showModalTypeDop, isActiveFilter, isOpenOrderMap, set_type_location, type_location } = useMapLogic()

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
            right: 15,
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
        <TouchableOpacity style={{ backgroundColor: 'transparent', position: 'absolute', right: 20, bottom: 150, zIndex: 22, padding: 10 }} onPress={() => showModalTypeDop(true)}>
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
          right: 10,
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

      {/* Яндекс-карта */}
      <YaMap
        showUserPosition={false}
        ref={mapRef}
        style={styles1.ymap}
        rotateGesturesEnabled={rotate_map}
        nightMode={night_map == 1}
      >
        {home && <HomeMarker point={home} getHome={getHome} />}
        <DriverMarker />
        <ListOrders />
      </YaMap>
      

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