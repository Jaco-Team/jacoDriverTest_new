import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CardOrder } from '@/entities/CardOrder/ui/CardOrder';
import { TypeLimit } from './TypeLimit';
import { OrdersListProps } from '@/features/orders-list/model/types';
import { appPalette } from '@/shared/styles/appPalette';

export function OrdersList({
  orders,
  isChecking,
  isGlobalLoading,
  getOrders,
  FormatPrice,
  showAlertText,
  globalFontSize,
  dialCall,
  actionButtonOrder,
  setActiveConfirm,
}: OrdersListProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isCheckingRef = useRef(isChecking)
  const refreshRequestResolvedRef = useRef(false)

  useEffect(() => {
    isCheckingRef.current = isChecking

    if (
      isRefreshing &&
      refreshRequestResolvedRef.current &&
      !isChecking
    ) {
      refreshRequestResolvedRef.current = false
      setIsRefreshing(false)
    }
  }, [isChecking, isRefreshing])

  const handleRefresh = useCallback(async (): Promise<void> => {
    if (isRefreshing) return

    refreshRequestResolvedRef.current = false
    setIsRefreshing(true)
    try {
      await getOrders()
    } finally {
      refreshRequestResolvedRef.current = true

      if (!isCheckingRef.current) {
        refreshRequestResolvedRef.current = false
        setIsRefreshing(false)
      }
    }
  }, [getOrders, isRefreshing])

  const showListLoading = isChecking && !isGlobalLoading && !isRefreshing

  const emptyState = showListLoading ? (
    <View style={styles.loadingState} testID="orders-list-loading">
      <ActivityIndicator color={appPalette.brand} size="large" />
    </View>
  ) : (
    <View style={styles.emptyState} testID="orders-list-empty">
      <Text style={[styles.emptyText, { fontSize: globalFontSize }]}>
        Нет заказов для отображения
      </Text>
    </View>
  )

  return (
    <FlatList
      testID="orders-list"
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      refreshControl={(
        <RefreshControl
          colors={[appPalette.brand]}
          progressBackgroundColor="#FFFFFF"
          refreshing={isRefreshing}
          tintColor={appPalette.brand}
          onRefresh={handleRefresh}
        />
      )}
      data={orders}
      removeClippedSubviews={Platform.OS === 'android'}
      renderItem={({ item }) => (
        <CardOrder
          item={item}
          FormatPrice={FormatPrice}
          showAlertText={showAlertText}
          globalFontSize={globalFontSize}
          dialCall={dialCall}
          actionButtonOrder={actionButtonOrder}
          setActiveConfirm={setActiveConfirm}
        />
      )}
      keyExtractor={item => item.id_text}
      style={styles.list}
      contentContainerStyle={styles.content}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={<TypeLimit />}
      ListFooterComponent={<View style={styles.footer} />}
      ListEmptyComponent={emptyState}
    />
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: appPalette.surface,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  loadingState: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 44,
  },
  emptyState: {
    minHeight: 150,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 52,
  },
  emptyText: {
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Regular',
    lineHeight: 24,
    textAlign: 'center',
  },
  footer: {
    height: 72,
  },
})
