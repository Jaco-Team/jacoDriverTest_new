import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { appPalette } from '@/shared/styles/appPalette'
import type { FeedbackResponse } from '@/shared/store/FeedbackStoreType'

export const TypeBadge: React.FC<{
  type: FeedbackResponse['type']
  globalFontSize: number
}> = ({ type, globalFontSize }) => (
  <View style={styles.badge}>
    <Text style={[styles.text, { fontSize: Math.min(19, Math.max(13, globalFontSize - 1)) }]}>
      {type}
    </Text>
  </View>
)

const styles = StyleSheet.create({
  badge: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: appPalette.surfaceAlt,
  },
  text: { color: appPalette.text, fontFamily: 'Roboto-Medium', lineHeight: 18 },
})
