import React from 'react'
import { View, Text } from 'react-native'
import { Divider } from '@/components/ui/divider'
import { Icon, InfoIcon } from '@/components/ui/icon'
import { TextPopover } from './TextPopover'

import { TextDescriptionProps } from '../model/types'

export function TextDescription({ text, value, title, FormatPrice, bottom_devider = true, globalFontSize, type }: TextDescriptionProps) {
  return (
    <>
      <View className={ 'flex-row items-center justify-between ' } >
      
        {title ?
          <TextPopover 
            title={title}
            globalFontSize={globalFontSize}
            Main={
              <View className={ 'flex-row items-center p-3 pl-0'} >
                <Text className='font-bold pr-3' style={{ fontSize: globalFontSize }}>{text}</Text>
                <Icon as={InfoIcon} className="text-typography-500" style={{ width: globalFontSize * 1.2, height: globalFontSize * 1.2 }} />
              </View>
            }           
          />
            :
          <Text className={'font-bold p-3 pl-0' + ( bottom_devider === true ? '' : ' pb-0' )} style={{ fontSize: globalFontSize }}>{text}</Text>
        }

        <Text className={'p-3 pl-0 pr-0' + ( bottom_devider === true ? '' : ' pb-0' )} style={{ fontSize: globalFontSize }}>{FormatPrice(value)} { type == 'price' ? '₽' : '' }</Text>
      </View>

      {bottom_devider && <Divider /> }
    </>
  )

}