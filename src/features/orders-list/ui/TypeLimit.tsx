import React from 'react';

import { StyleSheet, Text, View } from 'react-native';

import { OrdersTypeList } from './OrdersTypeList';
import { useTypeLimit } from '../model/useTypeLimit';
import { appPalette } from '@/shared/styles/appPalette';

export function TypeLimit(): React.JSX.Element {
  const { limit_summ, limit_count, globalFontSize } = useTypeLimit()

  return (
    <View style={styles.summary} testID="orders-list-summary">
      <View style={styles.statusColumn}>
        <OrdersTypeList />
      </View>

      {limit_count.length > 0 ? (
        <Text
          numberOfLines={1}
          style={[styles.statText, styles.countText, { fontSize: globalFontSize }]}
          testID="orders-list-limit-count"
        >
          {limit_count}
        </Text>
      ) : null}

      <View style={styles.limitColumn}>
        <Text
          numberOfLines={1}
          style={[styles.statText, styles.limitText, { fontSize: globalFontSize }]}
          testID="orders-list-limit-sum"
        >
          {limit_summ}
        </Text>
      </View>
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
  statusColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
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
    lineHeight: 22,
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
