import React, { memo } from 'react';

import {View, StyleSheet} from 'react-native';

import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import { faMapMarkerAlt, faDotCircle } from '@fortawesome/free-solid-svg-icons';

import { Marker } from 'react-native-yamap';

import { Path, G, Svg } from 'react-native-svg';

import { MapPointProps } from '../model/types'

import { MarkerText } from '@/shared/ui/MarkerText'

export const OrderMarker = memo(function MapPoint({theme, item, mapScale, showOrdersMap, globalFontSize}: MapPointProps){

  let active_w = (item?.point_text + '').length * ( globalFontSize / 2.5 ) + 55;

  if( (item?.point_text + '').length <= 2 ){
    active_w = 60;
  }

  return (
    <Marker
      onPress={() => showOrdersMap(item.id)}
      point={item.xy}
      anchor={{x: 0.03, y: 0.8}}
      scale={mapScale}
      children={
        <View 
          style={[styles1.marker, { width: active_w, height: 'auto' } ]}
        >
          
          { theme == 'classic' ? 
            <View className='w-5 h-7 ml-1 mt-1'>
              <Svg width="100%" height="100%" viewBox="0 0 183 285">
                <G className="layer">
                  <Path
                    fill={(item.point_color ? item.point_color : item.color) ?? 'blue'}
                    d="M91.2 1.9C41.4 1.9 1 42.3 1 92.1s40.4 90.2 90.2 90.2 5.9-.1 8.8-.4c-6.9 24.7-26.5 94.8-27.4 97.5-1 3.3 3.3 5.6 5.9 2.6s26.7-28.5 44.9-55.5c31.6-46.7 46-78.2 46-78.2 11.9-21.2 11.9-45.1 11.9-56.2 0-49.8-40.4-90.2-90.2-90.2zm0 157c-36.9 0-66.8-29.9-66.8-66.8s29.9-66.8 66.8-66.8S158 55.2 158 92.1s-29.9 66.8-66.8 66.8m0-101.8c-19.3 0-35 15.7-35 35s15.7 35 35 35 35-15.7 35-35-15.7-35-35-35"
                  ></Path>
                </G>
              </Svg>
            </View>
              :
            <FontAwesomeIcon
              size={20}
              color={(item.point_color ? item.point_color : item.color) ?? 'blue'}
              icon={!item.close_time_ ? faDotCircle : faMapMarkerAlt}
            />
          }

          <MarkerText
            globalFontSize={globalFontSize}
            theme={theme}
            text={item?.point_text}
          />
        
        </View>
      }
    />
  )
}, areEqual)

function areEqual(prevProps: MapPointProps, nextProps: MapPointProps) {
  return prevProps.item.to_time_sec_min === nextProps.item.to_time_sec_min && prevProps.theme === nextProps.theme && prevProps.globalFontSize === nextProps.globalFontSize && prevProps.mapScale === nextProps.mapScale;
}

const styles1 = StyleSheet.create({
  marker: {
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50
  },
});