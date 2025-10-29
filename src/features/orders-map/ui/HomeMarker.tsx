import React, { memo } from 'react';

import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import { faHouse } from '@fortawesome/free-solid-svg-icons';

import { Marker } from 'react-native-yamap';

import { MapPointHouse } from '../model/types'

export const HomeMarker = memo(function MapPointHouse({point, getHome}: MapPointHouse){
  return (
    <Marker
      point={point}
      onPress={getHome}
      children={
        <FontAwesomeIcon size={20} color={"#000"} icon={faHouse} />
      }
    />
  )
}, areEqual2)

function areEqual2(prevProps: MapPointHouse, nextProps: MapPointHouse) {
  return JSON.stringify(prevProps.point) === JSON.stringify(nextProps.point);
}
