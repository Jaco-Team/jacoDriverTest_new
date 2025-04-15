import React, { useState } from 'react'

import {View, Text, FlatList} from 'react-native';

import { CardOrder } from '@/entities/CardOrder/ui/CardOrder';
import { TypeLimit } from './TypeLimit';
import { OrdersListProps } from '@/features/orders-list/model/types';

export function OrdersList({ orders, getOrders, FormatPrice, showAlertText, globalFontSize, dialCall, actionButtonOrder, setActiveConfirm }: OrdersListProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <FlatList
      refreshing={isRefreshing}
      onRefresh={() => getOrders()}
      data={orders}
      removeClippedSubviews={true}
      renderItem={({item}) => (
        <CardOrder item={item} FormatPrice={FormatPrice} showAlertText={showAlertText} globalFontSize={globalFontSize} dialCall={dialCall} actionButtonOrder={actionButtonOrder} setActiveConfirm={setActiveConfirm} />
      )}
      keyExtractor={item => item.id_text}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}

      ListHeaderComponent={() => <TypeLimit />}
      ListFooterComponent={() => <View className='h-20'></View>}
      ListEmptyComponent={() => <Text className='font-semibold text-center mt-10' style={{ fontSize: globalFontSize }}>Нет заказов</Text>}
    />
  )
}