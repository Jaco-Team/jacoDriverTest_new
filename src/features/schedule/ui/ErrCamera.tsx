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

import { ModalErrCam } from './ModalErrCam';

import dayjs from 'dayjs';

import { useErrorCamera } from '../model/useError'

export function ErrCamera(): React.JSX.Element {
  const { globalFontSize, err_cam, showModalErrCam } = useErrorCamera();

  return (
    <View className='m-5 p-5 bg-white rounded-xl shadow-zinc-500 shadow'>

      <View className='flex-row items-center text-center justify-center w-full'>
        <Text className='font-bold text-lg'>Ошибки по камерам</Text>
      </View>
      
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead className='w-5/12' style={{ fontSize: globalFontSize }}>Дата</TableHead>
            <TableHead className='w-7/12' style={{ fontSize: globalFontSize }}>Ошибка</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          { err_cam.map((item, index) => {
            return (
              <TouchableOpacity key={index} onPress={ () => { showModalErrCam(true, item) } }>
                <TableRow>
                  <TableData useRNView={true} className='w-5/12 h-auto flex flex-row justify-start items-center text-left'>
                    <View className=''>
                      <Text style={{ fontSize: globalFontSize }} className='font-medium leading-[22px] text-typography-800 font-roboto'>{ dayjs(new Date(item.date_time_close)).format('YYYY-MM-DD') }</Text>
                    </View>
                  </TableData>
                  <TableData style={{ fontSize: globalFontSize }} className='w-7/12'>{item.fine_name}</TableData>
                </TableRow>
              </TouchableOpacity>
            )
          })}
        </TableBody>
      </Table>
      
      <ModalErrCam />
    </View>
  );
}