import React, { memo } from 'react'
import {
  View,
  TouchableOpacity,
} from 'react-native'

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons'

import { MapPointTimeType } from '@/shared/store/SettingsStoreType'  //components/store/SettingsStoreType'
import { Path, G, Svg } from 'react-native-svg'

import { MarkerText } from '@/shared/ui/MarkerText'

export const MapPointTime = memo(function MapPointTime({
  theme,
  text,
  setActive,
  value,
  isActive
}: MapPointTimeType): React.JSX.Element {
  return (
    <View className="inline-flex flex-row items-center">
      {theme === 'classic' ? (
        <View className="w-5 h-7 ml-1 mt-1">
          <Svg width="100%" height="100%" viewBox="0 0 183 285">
            <G className="layer">
              <Path
                fill={isActive === true ? 'red' : 'blue'}
                d="M91.2 1.9C41.4 1.9 1 42.3 1 92.1s40.4 90.2 90.2 90.2 5.9-.1 8.8-.4c-6.9 24.7-26.5 94.8-27.4 97.5-1 3.3 3.3 5.6 5.9 2.6s26.7-28.5 44.9-55.5c31.6-46.7 46-78.2 46-78.2 11.9-21.2 11.9-45.1 11.9-56.2 0-49.8-40.4-90.2-90.2-90.2zm0 157c-36.9 0-66.8-29.9-66.8-66.8s29.9-66.8 66.8-66.8S158 55.2 158 92.1s-29.9 66.8-66.8 66.8m0-101.8c-19.3 0-35 15.7-35 35s15.7 35 35 35 35-15.7 35-35-15.7-35-35-35"
              />
            </G>
          </Svg>
        </View>
      ) : (
        <FontAwesomeIcon
          size={20}
          color={isActive === true ? 'red' : 'blue'}
          icon={faMapMarkerAlt}
        />
      )}

      <TouchableOpacity onPress={() => setActive(value)}>

        <MarkerText
          globalFontSize={16}
          theme={theme}
          text={text || '14:32 (15 мин.)'}
        />

      </TouchableOpacity>
    </View>
  )
})