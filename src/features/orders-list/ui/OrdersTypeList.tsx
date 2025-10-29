import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  Actionsheet,
  ActionsheetContent,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetBackdrop,
} from "@/components/ui/actionsheet"

//import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'

import { useGlobalStore, useOrdersStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import { TypeOrder } from '@/shared/store/OrdersStoreType';

export const OrdersTypeList: React.FC = () => {
  const [isActionSheetVisible, setActionSheetVisible] = useState(false);

  const [ globalFontSize ] = useGlobalStore(useShallow( state => [ state.globalFontSize ]));
  const [ type, types, selectType ] = useOrdersStore(useShallow( state => {
    return [ state.type, state.types, state.selectType ];
  }));
  console.log("🚀 === OrdersTypeList type:", type);

  const handleSelect = (item: TypeOrder) => {
    selectType(item);
    setActionSheetVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setActionSheetVisible(true)}
      >
        <Text className="text-primary-main font-medium" style={{ fontSize: globalFontSize }}>
          {type ? type.text : 'Выберите элемент'}
        </Text>
      </TouchableOpacity>

      <Actionsheet isOpen={isActionSheetVisible} onClose={() => setActionSheetVisible(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator className='h-3 w-full bg-transparent justify-center items-center'>
              <View className='w-2/12 h-1 bg-gray-400 rounded' />
            </ActionsheetDragIndicator>
          </ActionsheetDragIndicatorWrapper>

          {types.map((item) => (
            <ActionsheetItem key={item.id} onPress={() => handleSelect(item)}>
              <ActionsheetItemText className={"text-center p-2 w-full font-medium " + ( type.id == item.id ? 'text-primary-main' : 'text-black' )} style={{ fontSize: globalFontSize }}>{item.text}</ActionsheetItemText>
            </ActionsheetItem>
          ))}

        </ActionsheetContent>
      </Actionsheet>
    </>
  );
};
