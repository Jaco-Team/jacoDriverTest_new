import React, { memo } from 'react'
import { Platform } from 'react-native'

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faHouse } from '@fortawesome/free-solid-svg-icons'

import { Marker } from 'react-native-yamap-plus'

import { MapPointHouse } from '../model/types'

type HomeMarkerProps = MapPointHouse & { isDark: boolean }

export const HomeMarker = memo(function MapPointHouse({point, getHome, isDark}: HomeMarkerProps){

  return (
    <Marker
      key={Platform.OS === 'ios' ? (isDark ? 'home-dark' : 'home-light') : undefined}
      point={point}
      onPress={getHome}
      children={
        <FontAwesomeIcon
          color={isDark ? '#FFFFFF' : '#000000'}
          icon={faHouse}
          size={20}
          testID="orders-map-home-icon"
        />
      }
    />
  )
}, areEqual2)

function areEqual2(prevProps: HomeMarkerProps, nextProps: HomeMarkerProps) {
  return prevProps.isDark === nextProps.isDark &&
    prevProps.getHome === nextProps.getHome &&
    JSON.stringify(prevProps.point) === JSON.stringify(nextProps.point)
}
