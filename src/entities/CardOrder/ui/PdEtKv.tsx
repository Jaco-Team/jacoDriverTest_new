import React from 'react'
import { StyleSheet, Text } from 'react-native'

import { toOrderInt } from '@/entities/CardOrder/model/normalizeOrderValue'
import { PdEtKvProps } from '@/entities/CardOrder/model/types'

export const PdEtKv: React.FC<PdEtKvProps> = ({
  item,
  textColor = '#1F2D38',
  textStyle,
}) => {
  const displayItems = [
    { key: 'pd', label: 'Пд', value: item.pd },
    { key: 'et', label: 'Эт', value: item.et },
    { key: 'kv', label: 'Кв', value: item.kv },
  ].filter(({ value }) => toOrderInt(value) > 0)

  if (displayItems.length === 0) return null

  return (
    <Text
      style={[styles.row, textStyle, { color: textColor }]}
      testID="pdetkv"
    >
      {displayItems.map((element, index) => (
        <React.Fragment key={element.key}>
          {index > 0 ? (
            <Text
              style={[styles.label, textStyle, { color: textColor }]}
              testID="pdetkv-sep"
            >
              ,{' '}
            </Text>
          ) : null}
          <Text testID={`pdetkv-${element.key}`}>
            <Text
              style={[styles.label, textStyle, { color: textColor }]}
              testID={`pdetkv-${element.key}-label`}
            >
              {element.label}:{' '}
            </Text>
            <Text
              style={[styles.value, textStyle, { color: textColor }]}
              testID={`pdetkv-${element.key}-value`}
            >
              {element.value}
            </Text>
          </Text>
        </React.Fragment>
      ))}
    </Text>
  )
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 8,
  },
  label: {
    fontFamily: 'Roboto-Medium',
  },
  value: {
    fontFamily: 'Roboto-Regular',
  },
})
