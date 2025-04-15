import { View, Text, TouchableOpacity } from 'react-native';
import { HStack } from '@/components/ui/hstack';

import { RefreshCcw } from 'lucide-react-native';

import { useLimitLogic } from "../model/useLimitLogic"

export function TypeLimit() {
  const { getOrders, limit_summ, limit_count, selectType, type, globalFontSize, night_map } = useLimitLogic()

  return (
    <View className='flex flex-row items-center justify-center absolute h-auto bottom-12 bg-black opacity-80 rounded-full left-5 right-5'>
      <HStack className={ (limit_count.length > 0 ? 'justify-between' : 'justify-center') + ' m-3 p-2 ml-5 mr-5 mb-0 absolute bottom-14'}>
        <Text className='font-semibold' style={{ fontSize: globalFontSize, color: night_map == 1 ? '#fff' : '#000' }}>{limit_summ}</Text>
        {limit_count.length > 0 && <Text className='font-semibold' style={{ fontSize: globalFontSize, color: night_map == 1 ? '#fff' : '#000' }}>{limit_count}</Text>}
      </HStack>

      <HStack className='justify-between w-full h-full'>
        <TouchableOpacity className='pl-5 pr-3 pt-3 pb-3 justify-center items-center' onPress={ () => { selectType({id: 1, text: 'Активные'}) } }>
          <Text className='font-semibold' style={{ fontSize: globalFontSize, color: type.id == 1 ? 'green' : '#fff' }}>Активные</Text>
        </TouchableOpacity>
        
        <TouchableOpacity className='pl-3 pr-3 pt-3 pb-3 justify-center items-center' onPress={ () => { selectType({id: 2, text: 'Мои отмеченные'}) } }>
          <Text className='font-semibold text-white' style={{ fontSize: globalFontSize, color: type.id == 2 ? 'green' : '#fff' }}>Мои</Text>
        </TouchableOpacity>

        <TouchableOpacity className='pl-3 pr-3 pt-3 pb-3 justify-center items-center' onPress={ () => { selectType({id: 5, text: 'У других курьеров'}) } }>
          <Text className='font-semibold text-white' style={{ fontSize: globalFontSize, color: type.id == 5 ? 'green' : '#fff' }}>У других</Text>
        </TouchableOpacity>

        <TouchableOpacity className='pr-5 pl-3 justify-center items-center' onPress={ () => { getOrders(true) } }>
          <RefreshCcw size={25} color={'#fff'} />
        </TouchableOpacity>
      </HStack>
    </View>
  )
}