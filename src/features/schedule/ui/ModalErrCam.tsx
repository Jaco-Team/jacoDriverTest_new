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

import { useErrorCamera } from '../model/useErrorModal'

export function ModalErrCam(): React.JSX.Element {

  const { 
    isShowModalErrCam,
    modalErrCam,
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
    onSubmitError 
  } = useErrorCamera()

  return (
    <>
      <Modal
        isOpen={isShowModalErrCam}
        onClose={closeModal}
        size="lg"
        className="rounded-lg"
      >
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Heading size="md" className="text-typography-950 text-center">
              Ошибка №{modalErrCam?.id}
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
                  <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Дата время ошибки: </Text>
                  <Text className="color-black" style={{ fontSize: globalFontSize }}>{modalErrCam?.date_time_fine}</Text>
                </View>

                <View className="flex flex-row flex-wrap pt-5">
                  <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Ошибка: </Text>
                  <Text className="color-black" style={{ fontSize: globalFontSize }}>{modalErrCam?.fine_name}</Text>
                </View>

                <View className="flex flex-row flex-wrap pt-5">
                  <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Сумма: </Text>
                  <Text className="color-black" style={{ fontSize: globalFontSize }}>{FormatPrice(modalErrCam?.price || 0)} ₽</Text>
                </View>

                {modalErrCam?.imgs?.length == 0 ? null : (
                  <View className="flex flex-row flex-wrap pt-5">
                    <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Фото</Text>
                  </View>
                )}

                {modalErrCam?.imgs?.length == 0 ? null : (
                  <View className="flex flex-row flex-wrap pt-5">
                    { transformedArray?.map((images, index) => {
                      return (
                        <TouchableOpacity onPress={() => { openImage(index) } } key={index}>
                          <Image 
                            source={{ uri: images?.uri }} 
                            style={{ width: 100, height: 100 }} 
                          />
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
    
                {modalErrCam?.text_one?.length == 0 ? modalErrCam?.is_edit == 0 ? null : (
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

                    <Button onPress={onSubmitError} className="bg-primary-main w-full">
                      <Text className="text-white font-normal" style={{ fontSize: globalFontSize }}>Обжаловать</Text>
                    </Button>
                  </View>
                ) : (
                  <View className="flex flex-row flex-wrap pt-5">
                    <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Причина обжалования:</Text>
                    <Text className="color-black" style={{ fontSize: globalFontSize }}>{modalErrCam?.text_one}</Text>
                  </View>
                )}

                {modalErrCam?.text_two?.length == 0 ? null : (
                  <View className="flex flex-row flex-wrap pt-5">
                    <Text className="font-bold color-black" style={{ fontSize: globalFontSize }}>Ответ обжалования: </Text>
                    <Text className="color-black" style={[{ fontSize: globalFontSize }]}>{modalErrCam?.text_two}</Text>
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