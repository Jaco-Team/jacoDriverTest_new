import React from 'react'
import { View, Text } from 'react-native';

import {
  Checkbox,
  CheckboxIndicator,
  CheckboxLabel,
  CheckboxIcon,
  CheckboxGroup
} from '@/components/ui/checkbox'
import { CheckIcon } from '@/components/ui/icon'
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'

import { useModalFilterOrdersLogic } from "../model/useModalOrderLogic"

export const ModalFilterOrders = () => {
  
  const {
    globalFontSize,
    sheetIndex,
    bottomSheetRef,
    snapPoints,
    types_dop, 
    type_dop,
    setTypeDop,
    handleSheetChanges
  } = useModalFilterOrdersLogic();

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={sheetIndex} 
      snapPoints={snapPoints} // ['50%', '25%']
      enablePanDownToClose    // позволяет свайпом вниз закрыть
      backdropComponent={BottomSheetBackdrop} // полу-прозрачный фон
      onChange={handleSheetChanges}
      style={{ zIndex: 1000 }}
      backgroundStyle={{ borderRadius: 30, backgroundColor: '#f9fafb' }}
    >
      <BottomSheetScrollView className='flex bg-gray-50' style={{zIndex: 30}}>
          <Text className='font-semibold text-black p-5 text-center' style={{ fontSize: globalFontSize }}>Только для Активных заказов</Text>

          <CheckboxGroup
            value={type_dop}
            onChange={(keys) => {
              setTypeDop(keys)
            }}
            className="mb-3"
          >
            {types_dop.map((item) => (
              <Checkbox key={item.id} value={item.id+''} size='lg' className="mb-3 ml-5 mt-3 w-2/4">
                <CheckboxIndicator>
                  <CheckboxIcon as={CheckIcon} />
                </CheckboxIndicator>
                <CheckboxLabel style={{ fontSize: globalFontSize, fontWeight: '500' }}>
                  {item.text}
                </CheckboxLabel>
              </Checkbox>
            ))
            }
            
          </CheckboxGroup>

        <View className='w-full h-20' />
        
      </BottomSheetScrollView>
    </BottomSheet>
  );
};