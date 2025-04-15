import { View, Text } from 'react-native';

import { Theme } from '@/shared/types/globalTypes'

interface MarkerTextProps {
  globalFontSize: number,
  theme: Theme,
  text: string
}

export function MarkerText({globalFontSize, theme, text}: MarkerTextProps) {

  if( theme == 'transparent' ){
    return (
      <View className='rounded-md bg-transparent ml-1 border-black border-0'>
        <Text className='pl-2 pr-2 pt-1 pb-1 text-black' style={{ fontSize: globalFontSize }}>{text}</Text>
      </View>
    )
  }

  if( theme == 'white' ){
    return (
      <View className='rounded-md bg-white ml-1 border-black border-0'>
        <Text className='pl-2 pr-2 pt-1 pb-1 text-black' style={{ fontSize: globalFontSize }}>{text}</Text>
      </View>
    )
  }

  if( theme == 'white_border' ){
    return (
      <View className='rounded-md bg-white ml-1 border-black border'>
        <Text className='pl-2 pr-2 pt-1 pb-1 text-black' style={{ fontSize: globalFontSize }}>{text}</Text>
      </View>
    )
  }

  if( theme == 'black' ){
    return (
      <View className='rounded-md bg-black ml-1 border-black border'>
        <Text className='pl-2 pr-2 pt-1 pb-1 text-white' style={{ fontSize: globalFontSize }}>{text}</Text>
      </View>
    )
  }

  if( theme == 'classic' ){
    return (
      <View className='rounded-md bg-white ml-0 border-0 opacity-85'>
        <Text className='pl-2 pr-2 pt-1 pb-1 text-black' style={{ fontSize: globalFontSize }}>{text}</Text>
      </View>
    )
  }
}