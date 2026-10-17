import React from 'react';

import { StyleSheet, Text, View } from 'react-native';

import { OrdersTypeList } from './OrdersTypeList';
import { useTypeLimit } from '../model/useTypeLimit';
import { appPalette } from '@/shared/styles/appPalette';
import { useAppTheme } from '@/shared/theme/AppThemeProvider'

export function TypeLimit(): React.JSX.Element {
  const { colors } = useAppTheme()
  const { limit_summ, limit_count, globalFontSize } = useTypeLimit()
  const usesLargeTextLayout = globalFontSize >= 22

  const count = limit_count.length > 0 ? (
    <Text
      numberOfLines={1}
      style={[
        styles.statText,
        styles.countText,
        {
          color: colors.text,
          fontSize: globalFontSize,
          lineHeight: Math.round(globalFontSize * 1.35),
        },
      ]}
      testID="orders-list-limit-count"
    >
      {limit_count}
    </Text>
  ) : null

  const limit = (
    <View style={styles.limitColumn}>
      <Text
        numberOfLines={1}
        style={[
          styles.statText,
          styles.limitText,
          {
            color: colors.text,
            fontSize: globalFontSize,
            lineHeight: Math.round(globalFontSize * 1.35),
          },
        ]}
        testID="orders-list-limit-sum"
      >
        {limit_summ}
      </Text>
    </View>
  )

  return (
    <View
      style={[
        styles.summary,
        usesLargeTextLayout && styles.summaryLargeText,
        { backgroundColor: colors.surface },
      ]}
      testID="orders-list-summary"
    >
      <View style={[styles.statusColumn, usesLargeTextLayout && styles.statusColumnLargeText]}>
        <OrdersTypeList />
      </View>

      {usesLargeTextLayout ? (
        <View style={styles.largeTextStats} testID="orders-list-large-text-stats">
          {count}
          {limit}
        </View>
      ) : (
        <>
          {count}
          {limit}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  summary: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 7,
    backgroundColor: appPalette.surface,
  },
  summaryLargeText: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  statusColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  statusColumnLargeText: {
    width: '100%',
    flex: 0,
  },
  largeTextStats: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  limitColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  statText: {
    color: '#111111',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },
  countText: {
    flexShrink: 0,
    textAlign: 'center',
  },
  limitText: {
    maxWidth: '100%',
    textAlign: 'right',
  },
})
