import React from 'react'

import { useOrdersList } from '../model/useOrdersList'
import { OrdersList } from './OrdersList'
import { CardOrderModalConfirm } from '@/entities/CardOrder/ui/ModalConfirm'
import { ModalFilterOrders } from '@/features/orders-map/ui/ModalFilterOrders'

import { useDialCall } from '@/shared/lib/useDialCall';
import { useOrdersUpdater } from '@/shared/lib/useOrdersUpdater';

import { ScreenLayout } from '@/shared/ui/ScreenLayout'

export function OrdersListScreen() {
  const dialCall = useDialCall();
  
  const { orders, getOrders, update_interval, actionButtonOrder, setActiveConfirm, FormatPrice, showAlertText, globalFontSize } = useOrdersList()

  useOrdersUpdater(getOrders, update_interval)

  return (
    <ScreenLayout>
      
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
