import React from "react"

import { View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Image } from 'react-native';

import ImageView from "react-native-image-viewing";
import { Textarea, TextareaInput } from "@/components/ui/textarea"

import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalCloseButton,
  ModalHeader,
  ModalBody,
} from "@/components/ui/modal"
import { Text } from "@/components/ui/text"
import { Icon, CloseIcon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"

import { useErrorOrders } from '../model/useErrorModal'

export function ModalErrOrder(): React.JSX.Element {

  const {
    isShowModalErrOrder,
    modalErrOrder,
    FormatPrice,
    globalFontSize,
    visible,
    setVisible,
    indexImg,
    transformedArray,
    errorText,
    setTextError,
    closeModal,
    openImage,
    submitError,
  } = useErrorOrders()

  return (
    <>
      <Modal
        isOpen={isShowModalErrOrder}
        onClose={closeModal}
        size="lg"
        className="rounded-lg"
      >
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Heading size="md" className="text-typography-950 text-center">
              Ошибка по заказу №{modalErrOrder?.order_id}
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
            
            <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={100}>
              
              <ScrollView>
                <View className="flex flex-row flex-wrap pt-5">
                  <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Дата заказа: </Text>
                  <Text className="color-black" style={{ fontSize: globalFontSize }}>{modalErrOrder?.date_time_order}</Text>
                </View>

                <View className="flex flex-row flex-wrap pt-5">
                  <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Ошибка заказа: </Text>
                  <Text className="color-black" style={{ fontSize: globalFontSize }}>{modalErrOrder?.order_desc}</Text>
                </View>

                <View className="flex flex-row flex-wrap pt-5">
                  <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Сумма: </Text>
                  <Text className="color-black" style={{ fontSize: globalFontSize }}>{FormatPrice(modalErrOrder?.my_price || 0)} ₽</Text>
                </View>

                {modalErrOrder?.imgs?.length == 0 ? null : (
                  <View className="flex flex-row flex-wrap pt-5">
                    <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Фото</Text>
                  </View>
                )}

                {modalErrOrder?.imgs?.length == 0 ? null : (
                  <View className="flex flex-row flex-wrap pt-5">
                    { transformedArray?.map((images, index) => {
                      return (
                        <TouchableOpacity onPress={() => { openImage(index); } } key={index}>
                          <Image 
                            source={{ uri: images?.uri }} 
                            style={{ width: 100, height: 100 }} 
                          />
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
    
                {modalErrOrder?.new_text_1?.length == 0 ? modalErrOrder?.is_edit == 0 ? null : (
                  <View className="flex flex-row flex-wrap pt-5">
                    <Text className="font-bold color-black pb-3" style={{ fontSize: globalFontSize }}>Причина обжалования:</Text>

                    <Textarea
                      size="md"
                      isReadOnly={false}
                      isInvalid={false}
                      isDisabled={false}
                      className="w-full mb-5"
                    >
                      <TextareaInput 
                        placeholder="Что произошло на самом деле ?" 
                        style={{ fontSize: globalFontSize }} 
                        value={errorText} 
                        onChange={event => setTextError(event.nativeEvent.text)} 
                      />
                    </Textarea>

                    <Button onPress={submitError} className="bg-primary-main w-full">
                      <Text className="text-white font-normal" style={{ fontSize: globalFontSize }}>Обжаловать</Text>
                    </Button>
                  </View>
                ) : (
                  <View className="flex flex-row flex-wrap pt-5">
                    <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Причина обжалования:</Text>
                    <Text className="color-black" style={{ fontSize: globalFontSize }}>{modalErrOrder?.new_text_1}</Text>
                  </View>
                )}

                {modalErrOrder?.new_text_2?.length == 0 ? null : (
                  <View className="flex flex-row flex-wrap pt-5">
                    <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Ответ обжалования: </Text>
                    <Text className="color-black" style={[{ fontSize: globalFontSize }]}>{modalErrOrder?.new_text_2}</Text>
                  </View>
                )}
              </ScrollView>
              
            </KeyboardAvoidingView>

          </ModalBody>
        </ModalContent>
      </Modal>

      <ImageView
        images={transformedArray ?? []}
        imageIndex={indexImg}
        visible={visible}
        onRequestClose={() => setVisible(false)}
      />
    </>
  )
}