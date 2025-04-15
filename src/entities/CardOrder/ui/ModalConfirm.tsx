import React from "react"

import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalCloseButton,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal"
import { Text } from "@/components/ui/text"
import { Icon, CloseIcon } from "@/components/ui/icon"
import { Button, ButtonText } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"

import { useOrdersStore, useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

export function CardOrderModalConfirm(): React.JSX.Element {
  const [is_modalConfirm, type_confirm, order_confirm_id, order_confirm_is_delete, setActiveConfirm, actionButtonOrder] = useOrdersStore(useShallow( state => [ state.is_modalConfirm, state.type_confirm, state.order_confirm_id, state.order_confirm_is_delete, state.setActiveConfirm, state.actionButtonOrder ]));
  const [ globalFontSize ] = useGlobalStore( useShallow( state => [ state.globalFontSize ] ) )

  return (
    <Modal
      isOpen={is_modalConfirm}
      onClose={ () => { setActiveConfirm(false) }}
      size="lg"
      className="rounded-lg"
    >
      <ModalBackdrop />
      <ModalContent style={{backgroundColor: type_confirm === 'finish' ? '#3caa3c' : type_confirm === 'cancel' ? '#fc2847' : '#ffcc00', borderWidth: 0}}>
        <ModalHeader>
          <Heading className="text-center text-white" style={{ fontSize: globalFontSize }}>
            Подтвердите действие
          </Heading>
          <ModalCloseButton onPress={ () => setActiveConfirm(false) }>
            <Icon
              as={CloseIcon}
              size="md"
              className="stroke-background-400 group-[:hover]/modal-close-button:stroke-background-700 group-[:active]/modal-close-button:stroke-background-900 group-[:focus-visible]/modal-close-button:stroke-background-900"
            />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody>
          <Text className="text-white" style={{ fontSize: globalFontSize }}>
            {type_confirm === 'finish' ?  order_confirm_is_delete ? 'Заказ был отменен, точно завершить заказ' : 'Точно завершить заказ' : type_confirm === 'cancel' ? 'Точно отменить заказ' : 'Точно клиент не вышел на связь'} ?
          </Text>
        </ModalBody>
        <ModalFooter className=" justify-between ">
          <Button
            variant="outline"
            action="secondary"
            className="bg-zinc-500 rounded-lg border-0"
            onPress={ () => setActiveConfirm(false) }
          >
            <ButtonText className="text-white" style={{ fontSize: globalFontSize }}>Закрыть</ButtonText>
          </Button>
          <Button
            variant="outline"
            action="secondary"
            className="bg-green-600 rounded-lg border-0"
            onPress={ () => actionButtonOrder(type_confirm === 'finish' ? 3 : type_confirm === 'cancel' ? 2 : 1, order_confirm_id) }
          >
            <ButtonText className="text-white" style={{ fontSize: globalFontSize }}>Подтвердить</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}