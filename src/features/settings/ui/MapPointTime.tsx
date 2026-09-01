import React, { memo } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons'

import { MapPointTimeType } from '@/shared/store/SettingsStoreType'  //components/store/SettingsStoreType'
import { Path, G, Svg } from 'react-native-svg'

export const MapPointTime = memo(function MapPointTime({
  theme,
  text,
  setActive,
  value,
  isActive
}: MapPointTimeType): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      onPress={() => setActive(value)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`settings-map-data-${value}`}
    >
      <View style={styles.rowContent}>
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
          size={22}
          color={isActive === true ? 'red' : 'blue'}
          icon={faMapMarkerAlt}
        />
      )}

      <View style={styles.label}>
        <Text style={styles.labelText}>{text || '14:32 (15 мин.)'}</Text>
      </View>
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  row: {
    minHeight: 46,
    borderRadius: 12,
    justifyContent: 'center',
  },
  rowContent: {
    width: '100%',
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pressed: {
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  label: {
    alignSelf: 'center',
    maxWidth: '86%',
    marginLeft: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  labelText: {
    color: '#1f2b36',
    fontSize: 14,
    lineHeight: 18,
  },
})
