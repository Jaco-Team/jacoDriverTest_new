import React from 'react'
import { Text } from 'react-native';
import { useOrdersStore } from '@/shared/store/store';

import { useOrdersList } from '../model/useOrdersList'
import { OrdersList } from './OrdersList'
import { CardOrderModalConfirm } from '@/entities/CardOrder/ui/ModalConfirm'
import { ModalFilterOrders } from '@/features/orders-map/ui/ModalFilterOrders'

import { useDialCall } from '@/shared/lib/useDialCall';
import { useOrdersUpdater } from '@/shared/lib/useOrdersUpdater';

import { ScreenLayout } from '@/shared/ui/ScreenLayout'

export function OrdersListScreen() {
  const dialCall = useDialCall();
  const savedAt = useOrdersStore(state => state.activeOrdersSavedAt);
  const showingSaved = useOrdersStore(state => state.showingSavedOrders);
  
  const { orders, getOrders, update_interval, actionButtonOrder, setActiveConfirm, FormatPrice, showAlertText, globalFontSize } = useOrdersList()

  useOrdersUpdater(getOrders, update_interval)

  return (
    <ScreenLayout>
      {savedAt && (
        <Text accessibilityRole="text" style={{ padding: 12, color: '#555', backgroundColor: '#fff3cd' }}>
          {showingSaved ? 'Сохранённые заказы. Данные могут быть устаревшими.' : 'Активные заказы сохранены для просмотра без интернета.'}
          {'\n'}Обновлено: {new Date(savedAt).toLocaleString('ru-RU')}
        </Text>
      )}
      
      <OrdersList 
        orders={orders}
        getOrders={getOrders}
        FormatPrice={FormatPrice}
        showAlertText={showAlertText}
        globalFontSize={globalFontSize}
        dialCall={dialCall}
        actionButtonOrder={actionButtonOrder}
        setActiveConfirm={setActiveConfirm}
      />
      
      <CardOrderModalConfirm />
      <ModalFilterOrders />
    </ScreenLayout>
  )
}
