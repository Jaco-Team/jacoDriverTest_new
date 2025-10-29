import React from 'react'
import { Button, ButtonText } from '@/components/ui/button'
import { View } from 'react-native'
import { HStack } from '@/components/ui/hstack'
import { VStack } from '@/components/ui/vstack'
import { QrCode } from 'lucide-react-native';

import { OrderActionsProps } from "@/entities/CardOrder/model/types"

export function OrderActions(props: OrderActionsProps) {
  const { item, dialCall, setActiveConfirm, actionButtonOrder, globalFontSize } = props
  const textStyle = { fontSize: globalFontSize };

  // можно взять
  if( item.is_get == 0 ){
    return (
      <>
        <Button className="mt-5 h-auto bg-gray-400 rounded-xl" onPress={ () => dialCall(item.number) } testID={`order-${item.id}-phone`}>
          <ButtonText style={textStyle} className="p-3">{item.number}</ButtonText>
        </Button>

        <Button className="mt-5 h-auto bg-green-600 rounded-xl" onPress={ () => actionButtonOrder(1, item.id) } testID={`order-${item.id}-take`}>
          <ButtonText style={textStyle} className="p-3">Взять</ButtonText>
        </Button>
      </>
    )
  }

  // мой заказ
  if( item.is_get == 1 && item.is_my == 1 ){
    return (
      <View>
        <HStack className="justify-between">
          {item.status_order == 6 ? null : (
            <Button 
              className="mt-5 h-auto bg-primary-main rounded-xl" 
              onPress={ () => setActiveConfirm(true, item.id, 'cancel', item.is_delete == 1 ? true : false) }
              testID={`order-${item.id}-cancel`}
            >
              <ButtonText style={textStyle} className="p-3 pl-1 pr-1 text-center">Отменить</ButtonText>
            </Button>
          )}

          <Button 
            className="mt-5 h-auto bg-gray-400 rounded-xl" 
            onPress={ () => dialCall(item.number) }
            testID={`order-${item.id}-phone`}
          >
            <ButtonText style={textStyle} className="p-3 pl-2 pr-2 text-center">{item.number}</ButtonText>
          </Button>
        </HStack>

        {item.status_order == 6 ? null : item.is_my === 1 && item.online_pay === 0 /*&& driver_pay === 1*/ ? (
          <HStack>
            <Button 
              className="mt-5 h-auto bg-green-600 rounded-xl" 
              onPress={ () => setActiveConfirm(true, item.id, 'finish', item.is_delete == 1 ? true : false) }
              testID={`order-${item.id}-finish`}
            >
              <ButtonText style={textStyle} className="p-3">Завершить</ButtonText>
            </Button>

            <Button className="mt-5 h-auto rounded-xl" testID={`order-${item.id}-qr`}>
              <ButtonText style={textStyle} className="p-3"><QrCode /></ButtonText>
            </Button>
          </HStack>
        ) : (
          <Button 
            className="mt-5 h-auto bg-green-600 rounded-xl" 
            onPress={ () => setActiveConfirm(true, item.id, 'finish', item.is_delete == 1 ? true : false) }
            testID={`order-${item.id}-finish`}
          >
            <ButtonText style={textStyle} className="p-3">Завершить</ButtonText>
          </Button>
        )}

        {item.status_order == 6 ? null : (
          <Button 
            className="mt-5 h-auto bg-yellow-400 rounded-xl" 
            onPress={ () => setActiveConfirm(true, item.id, 'fake', item.is_delete == 1 ? true : false) }
            testID={`order-${item.id}-fake`}
          >
            <ButtonText style={textStyle} className="p-3 color-black">Клиент не вышел на связь</ButtonText>
          </Button>
        )}
      </View>
    )
  }

  // у другого курьера
  return (
    <VStack>
      <Button 
        className="mt-5 h-auto bg-gray-400 rounded-xl" 
        testID={`order-${item.id}-other-name`}
      >
        <ButtonText style={textStyle} className="p-3">{item.driver_name}</ButtonText>
      </Button>

      <Button 
        className="mt-5 h-auto bg-gray-400 rounded-xl" 
        onPress={ () => dialCall(item.number) } 
        testID={`order-${item.id}-other-login`}
      >
        <ButtonText style={textStyle} className="p-3">{item.driver_login}</ButtonText>
      </Button>
    </VStack>
  )
}
