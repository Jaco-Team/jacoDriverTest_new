import React from 'react';

import { Text, View, TouchableOpacity } from 'react-native';

import {   
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableData,
  TableRow,
} from '@/components/ui/table';

import { ModalErrOrder } from './ModalErrOrder';

import dayjs from 'dayjs';

import { useErrorOrders } from '../model/useError'

export function ErrOrders(): React.JSX.Element {
  const { globalFontSize, err_orders, showModalErrOrder } = useErrorOrders();
  
  return (
    <View className='m-5 p-5 mt-0 mb-0 bg-white rounded-xl shadow-zinc-500 shadow'>

      <View className='flex-row items-center text-center justify-center w-full'>
        <Text className='font-bold text-lg'>Ошибки по заказам</Text>
      </View>
      
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead className='w-5/12' style={{ fontSize: globalFontSize }}>Дата</TableHead>
            <TableHead className='w-7/12' style={{ fontSize: globalFontSize }}>Ошибка</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          { err_orders.map((item, index) => {
            return (
              <TouchableOpacity key={index} onPress={ () => { showModalErrOrder(true, item) } }>
                <TableRow>
                  <TableData useRNView={true} className='w-5/12 h-auto flex flex-row justify-start items-center text-left'>
                    <View className=''>
                      <Text style={{ fontSize: globalFontSize }} className='font-medium leading-[22px] text-typography-800 font-roboto'>{ dayjs(new Date(item.date_time_order)).format('YYYY-MM-DD') }</Text>
                    </View>
                  </TableData>
                  <TableData style={{ fontSize: globalFontSize }} className='w-7/12'>{item.pr_name}</TableData>
                </TableRow>
              </TouchableOpacity>
            )
          })}
        </TableBody>
      </Table>
      
      <ModalErrOrder />
    </View>
  );
}