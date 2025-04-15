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

import { useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

export function ModalText(): React.JSX.Element {

  const [is_show_modal_text, modal_text, showModalText] = useGlobalStore(useShallow( state => [ state.is_show_modal_text, state.modal_text, state.showModalText ]));

  return (
    <Modal
      isOpen={is_show_modal_text}
      onClose={() => {
        showModalText(false)
      }}
      size="lg"
      className="rounded-lg"
    >
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md" className="text-typography-950 text-center">
            Внимание
          </Heading>
          <ModalCloseButton>
            <Icon
              as={CloseIcon}
              size="md"
              className="stroke-background-400 group-[:hover]/modal-close-button:stroke-background-700 group-[:active]/modal-close-button:stroke-background-900 group-[:focus-visible]/modal-close-button:stroke-background-900"
            />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody>
          <Text size="sm" className="text-typography-500">{modal_text}</Text>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            action="secondary"
            className="bg-blue-700 rounded-lg"
            onPress={() => {
              showModalText(false)
            }}
          >
            <ButtonText className="text-white">Хорошо</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}