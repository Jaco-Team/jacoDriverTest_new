import React, { memo } from 'react';

import {View, StyleSheet} from 'react-native';

import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import { faTruckFast } from '@fortawesome/free-solid-svg-icons';

import { Marker } from 'react-native-yamap';

import { useDriverMarkerLogic } from '../model/useDriverMarkerLogic';

import { MarkerText } from '@/shared/ui/MarkerText'

export const DriverMarker = memo(function DriverMarker(){

  const { location_driver, location_driver_time_text, globalFontSize, mapScale, theme } = useDriverMarkerLogic();

  if( !location_driver ) return null;

  return (
    <Marker
      point={location_driver}
      anchor={{x: 0.03, y: 0.8}}
      scale={mapScale}
      children={
        <View 
          style={[styles1.marker, { width: 100, height: 'auto' } ]}
        >
          <FontAwesomeIcon
            size={20}
            color={'red'}
            icon={faTruckFast}
          />

          <MarkerText 
            text={location_driver_time_text} 
            globalFontSize={globalFontSize}
            theme={theme}
          />          
        </View>
      }
    />
  )
})

const styles1 = StyleSheet.create({
  marker: {
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50
  },
});