import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { CardTagType } from '@/entities/CardOrder/model/types'
import { scaleGlobalFontSize } from '@/shared/lib/fontSize'

const TAG_COLORS = {
  blue: '#2196F3',
  purpur: '#9C27B0',
  red: '#F44336',
  green: '#4CAF50',
} as const

export const CardTag: React.FC<CardTagType> = ({
  text,
  color,
  count,
  globalFontSize,
}) => {
  const tagFontSize = scaleGlobalFontSize(14, globalFontSize, 12)

  return (
  <View
    style={[styles.tag, { backgroundColor: TAG_COLORS[color] }]}
    testID={`order-tag-${color}`}
  >
    <Text
      style={[
        styles.text,
        {
          fontSize: tagFontSize,
          lineHeight: Math.round(tagFontSize * 1.3),
        },
      ]}
    >
      {text}{count ? ` x${count}` : ''}
    </Text>
  </View>
  )
}

const styles = StyleSheet.create({
  tag: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
  },
  text: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Medium',
    textAlign: 'center',
  },
})
