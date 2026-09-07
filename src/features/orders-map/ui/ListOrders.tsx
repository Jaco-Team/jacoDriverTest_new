import React, { memo } from 'react';

import { OrderMarker } from './OrderMarker'

import { useListOrdersLogic } from '../model/useListOrdersLogic'
import { isValidMapPoint } from '../model/mapPoint'

export const ListOrders = memo(function MapPoints(){

  const { orders, showOrdersMap, globalFontSize, mapScale, theme } = useListOrdersLogic();

  return (
    <>
      {orders.filter((item) => isValidMapPoint(item.xy)).map((item) => (
        <OrderMarker key={item.id+'_'+item.to_time_sec_min} mapScale={mapScale} theme={theme} item={item} showOrdersMap={ showOrdersMap } globalFontSize={globalFontSize} />
      ))}
    </>
  )
})
