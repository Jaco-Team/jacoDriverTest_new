import React, { memo } from 'react';

import { OrderMarker } from './OrderMarker'

import { useListOrdersLogic } from '../model/useListOrdersLogic'

export const ListOrders = memo(function MapPoints(){

  const { orders, showOrdersMap, globalFontSize, mapScale, theme } = useListOrdersLogic();

  return (
    <>
      {orders.map((item, key) => (
        <OrderMarker key={item.id+'_'+item.to_time_sec_min} mapScale={mapScale} theme={theme} item={item} showOrdersMap={ showOrdersMap } globalFontSize={globalFontSize} />
      ))}
    </>
  )
})