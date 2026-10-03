import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Icon, InfoIcon } from '@/components/ui/icon'
import { TextPopover } from './TextPopover'

import { TextDescriptionProps } from '../model/types'
import { appPalette } from '@/shared/styles/appPalette'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'

export function TextDescription({
  text,
  value,
  title,
  emphasize = false,
  hideDivider = false,
  globalFontSize,
}: TextDescriptionProps): React.JSX.Element {
  const { colors } = useAppTheme()
  const label = (
    <View style={styles.labelContent}>
      <Text
        style={[
          styles.label,
          { color: colors.text },
          {
            fontSize: globalFontSize,
            lineHeight: Math.round(globalFontSize * 1.3),
          },
          emphasize && [styles.emphasizedText, { color: colors.text }],
        ]}
      >
        {text}
      </Text>
      {title ? (
        <Icon
          as={InfoIcon}
          color={colors.textMuted}
          style={{ width: 24, height: 24 }}
        />
      ) : null}
    </View>
  )

  return (
    <View
      style={[styles.row, { borderBottomColor: colors.border }, hideDivider && styles.lastRow]}
      testID={`price-metric-${text}`}
    >
      <View style={styles.labelColumn}>
        {title ? (
          <TextPopover
            Main={label}
            globalFontSize={globalFontSize}
            title={title}
          />
        ) : label}
      </View>

      <Text
        style={[
          styles.value,
          { color: colors.text },
          {
            fontSize: globalFontSize,
            lineHeight: Math.round(globalFontSize * 1.3),
          },
          emphasize && [styles.emphasizedText, { color: colors.text }],
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBED',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  labelColumn: {
    minWidth: 0,
    flex: 1,
  },
  labelContent: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    minWidth: 0,
    flexShrink: 1,
    color: '#312126',
    fontFamily: 'Roboto-Medium',
  },
  value: {
    maxWidth: '42%',
    flexShrink: 1,
    color: '#312126',
    fontFamily: 'Roboto-Medium',
    textAlign: 'right',
  },
  emphasizedText: {
    color: appPalette.primaryDeep,
    fontFamily: 'Roboto-Bold',
  },
})
