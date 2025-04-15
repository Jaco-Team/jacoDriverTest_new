import React from 'react';

import {Text, TouchableOpacity, View} from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { RefreshCcw } from 'lucide-react-native';

import { OrdersTypeList } from './OrdersTypeList';
import { useTypeLimit } from '../model/useTypeLimit';

export function TypeLimit(): React.JSX.Element {
  const { getOrders, limit_summ, limit_count, globalFontSize } = useTypeLimit()

  return (
    <HStack className="justify-between items-center m-5 mb-0">
      <OrdersTypeList />

      <HStack className="flex gap-2">
        {limit_count.length > 0 && 
          <View className="px-3 py-1">
            <Text className='font-semibold' style={{ fontSize: globalFontSize }}>{limit_count}</Text>
          </View>
        }
        <View className="pl-3 py-1">
          <Text className='font-semibold' style={{ fontSize: globalFontSize }}>{limit_summ}</Text>
        </View>
      </HStack>
    </HStack>
  )

  return (
    <>
      <HStack className='justify-between items-center m-5 mb-0'>
        <OrdersTypeList />

        <TouchableOpacity onPress={ () => getOrders(true) } className='p-3'>
          <RefreshCcw size={25} color={'#000'} />
        </TouchableOpacity>
      </HStack>
      
      <HStack className={ (limit_count.length > 0 ? 'justify-between' : 'justify-center') + ' m-3 p-2 ml-5 mr-5 mb-0'}>
        <Text className='font-semibold' style={{ fontSize: globalFontSize }}>{limit_summ}</Text>
        {limit_count.length > 0 && <Text className='font-semibold' style={{ fontSize: globalFontSize }}>{limit_count}</Text>}
      </HStack>
    </>
  )
}