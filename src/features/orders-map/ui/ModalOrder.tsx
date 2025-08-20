import React from 'react'
import { View } from 'react-native';

import { CardOrder } from '@/entities/CardOrder/ui/CardOrder';

import { useModalOrderLogic } from "../model/useModalOrderLogic"

import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'

export const ModalOrder = () => {
  
  const {
    FormatPrice,
    globalFontSize,
    showAlertText,
    showOrders,
    isOpenOrderMap,
    showOrdersMap,
    actionButtonOrder,
    setActiveConfirm,
    dialCall,
    sheetIndex,
    bottomSheetRef,
    snapPoints,
    handleSheetChanges
  } = useModalOrderLogic();

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={ isOpenOrderMap ? 2 : -1 } 
      snapPoints={snapPoints} // ['50%', '25%']
      enablePanDownToClose    // позволяет свайпом вниз закрыть
      backdropComponent={BottomSheetBackdrop} // полу-прозрачный фон
      //onChange={ (index: number) => { if( index < 0 ){ showOrdersMap(-1) } } }
      onChange={handleSheetChanges}
      style={{ zIndex: 1000 }}
      backgroundStyle={{ borderRadius: 30, backgroundColor: '#f9fafb' }}
    >
      <BottomSheetScrollView className='flex bg-gray-50'>
        
        {showOrders.map((item, key) => 
          <CardOrder key={key} item={item} FormatPrice={FormatPrice} showAlertText={showAlertText} globalFontSize={globalFontSize} dialCall={dialCall} actionButtonOrder={actionButtonOrder} setActiveConfirm={setActiveConfirm} /> 
        )}

        <View className='w-full h-20' />
        
      </BottomSheetScrollView>
    </BottomSheet>
  );
};