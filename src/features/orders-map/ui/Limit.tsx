import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useLimitLogic } from "../model/useLimitLogic"

export function TypeLimit() {
  const insets = useSafeAreaInsets()
  const { limit_summ, limit_count, selectType, type, globalFontSize, night_map } = useLimitLogic()
  const limitColor = night_map == 1 ? '#FFFFFF' : '#1F2B36'

  return (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.limits,
          { bottom: insets.bottom + 76 },
        ]}
        testID="orders-map-limits"
      >
        <Text
          style={[styles.limitText, { color: limitColor, fontSize: globalFontSize }]}
          testID="orders-map-limit-sum"
        >
          {limit_summ}
        </Text>
        {limit_count.length > 0 ? (
          <Text
            style={[styles.limitText, { color: limitColor, fontSize: globalFontSize }]}
            testID="orders-map-limit-count"
          >
            {limit_count}
          </Text>
        ) : null}
      </View>

      <View
        style={[styles.typeBar, { bottom: insets.bottom + 12 }]}
        testID="orders-map-type-bar"
      >
        <TouchableOpacity
          accessibilityLabel="Активные"
          accessibilityRole="button"
          style={styles.typeButton}
          testID="orders-map-type-active"
          onPress={() => selectType({ id: 1, text: 'Активные' })}
        >
          <Text
            style={[
              styles.typeText,
              { fontSize: globalFontSize, color: type.id == 1 ? '#22A33A' : '#FFFFFF' },
            ]}
          >
            АКТИВНЫЕ
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="Мои"
          accessibilityRole="button"
          style={styles.typeButton}
          testID="orders-map-type-mine"
          onPress={() => selectType({ id: 2, text: 'Мои отмеченные' })}
        >
          <Text
            style={[
              styles.typeText,
              { fontSize: globalFontSize, color: type.id == 2 ? '#22A33A' : '#FFFFFF' },
            ]}
          >
            МОИ
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="У других"
          accessibilityRole="button"
          style={styles.typeButton}
          testID="orders-map-type-other"
          onPress={() => selectType({ id: 5, text: 'У других курьеров' })}
        >
          <Text
            style={[
              styles.typeText,
              { fontSize: globalFontSize, color: type.id == 5 ? '#22A33A' : '#FFFFFF' },
            ]}
          >
            У ДРУГИХ
          </Text>
        </TouchableOpacity>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  limits: {
    position: 'absolute',
    zIndex: 20,
    right: 32,
    left: 32,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  limitText: {
    minWidth: 80,
    textAlign: 'center',
    fontFamily: 'Roboto-Bold',
  },
  typeBar: {
    position: 'absolute',
    zIndex: 20,
    right: 20,
    left: 20,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  typeButton: {
    minHeight: 52,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  typeText: {
    textAlign: 'center',
    fontFamily: 'Roboto-Bold',
  },
})
