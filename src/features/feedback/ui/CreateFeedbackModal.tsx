import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  Alert,
  Image,
  FlatList
} from 'react-native';

import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { Button, ButtonText } from '@/components/ui/button'

import ImageViewing from 'react-native-image-viewing';

import {
  Checkbox,
  CheckboxIndicator,
  CheckboxLabel,
  CheckboxIcon,
  CheckboxGroup
} from '@/components/ui/checkbox'
import { CheckIcon } from '@/components/ui/icon'

import { launchImageLibrary, launchCamera, ImagePickerResponse, Asset } from 'react-native-image-picker';

import { useCreateFeedbackModal } from '../model/useCreateFeedbackModal'

const CreateFeedbackModal: React.FC = () => {

  

  const {
    bottomSheetRef, 
    isCreateModalOpen, 
    globalFontSize,
    title, setTitle,
    description, setDescription,
    type, setType,
    is_need_notification, setIs_need_notification,
    handleSubmit,
    feedbackTypes,
    handleSheetChanges,
    images, setImages,
    handleImagePickerResponse,
    pickImageFromGallery,
    takePhoto,
    showImagePickerOptions,
    removeImage
  } = useCreateFeedbackModal();
  
  // Состояние для полноэкранного просмотра
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const openImageViewer = (index: number) => {
    setCurrentImageIndex(index);
    setIsImageViewerOpen(true);
  };

  const renderImageItem = ({ item, index }: { item: Asset; index: number }) => (
    <View className='mr-2 mb-2 relative'>
      <TouchableOpacity
        key={index}
        style={{ marginRight: 8, marginBottom: 8 }}
        onPress={() => openImageViewer(index)}
      >
        <Image
          source={{ uri: item.uri }}
          className='w-24 h-24 rounded-lg'
          resizeMode="cover"
        />
      </TouchableOpacity>
      
      <TouchableOpacity
        className='absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 items-center justify-center'
        onPress={() => removeImage(index)}
      >
        <Text className='text-white font-bold text-xs'>X</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={ isCreateModalOpen ? 2 : -1 } 
      snapPoints={['90%', '50%', '25%']} // ['50%', '25%']
      enablePanDownToClose    // позволяет свайпом вниз закрыть
      backdropComponent={BottomSheetBackdrop} // полу-прозрачный фон
      onChange={ handleSheetChanges }
      style={{ zIndex: 1000 }}
      backgroundStyle={{ borderRadius: 30, backgroundColor: '#fff' }}
      
    >
      <BottomSheetScrollView className='flex bg-white rounded-md' style={{zIndex: 30}}>
        <View className='flex-1 bg-white '>
          <View className='p-4 border-b border-gray-200'>
            <View className='flex-row justify-between items-center'>
              <Text className='leading-7 font-bold' style={{ fontSize: globalFontSize }}>Новое предложение</Text>
            </View>
          </View>

          <ScrollView className='flex-1 p-4'>
            <View className='mb-4'>
              <Text className='text-gray-700 mb-1 font-medium' style={{ fontSize: globalFontSize }}>Тип</Text>
              <View className='flex-row flex-wrap'>
                {feedbackTypes.map((feedbackType) => (
                  <TouchableOpacity
                    key={feedbackType}
                    className={`mr-2 mb-2 rounded-full py-2 px-4 pt-1.5 ${type === feedbackType ? 'bg-primary-main' : 'bg-gray-200'}`}
                    onPress={() => setType(feedbackType)}
                  >
                    <Text className={`leading-7 ${type === feedbackType ? 'text-white' : 'text-gray-800'}`} style={{ fontSize: globalFontSize }}>
                      {feedbackType}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className='mb-4'>
              <Text className='text-gray-700 mb-1 font-medium' style={{ fontSize: globalFontSize }}>Заголовок</Text>
              <TextInput
                className='border border-gray-300 rounded-lg p-3 bg-white'
                placeholder="Введите заголовок"
                style={{ fontSize: globalFontSize }}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View className='mb-4'>
              <Text className='text-gray-700 mb-1 font-medium' style={{ fontSize: globalFontSize }}>Описание</Text>
              <TextInput
                className='border border-gray-300 rounded-lg p-3 h-32 bg-white'
                placeholder="Расскажите о проблемах в работе приложения, предложите, как можно улучшить систему"
                style={{ fontSize: globalFontSize }}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </View>


            <View className='mb-4'>
              <Text className='text-gray-700 mb-1 font-medium'>Изображение (опционально)</Text>
              
              {images.length > 0 && (
                <View className='mb-2'>
                  <FlatList
                    data={images}
                    renderItem={renderImageItem}
                    keyExtractor={(item, index) => `image-${index}`}
                    horizontal={true}
                    showsHorizontalScrollIndicator={false}
                    //contentContainerStyle={tw('py-2')}
                  />
                </View>
              )}
              
              <TouchableOpacity
                className='border border-dashed border-gray-300 rounded-lg p-4 items-center justify-center h-16'
                onPress={showImagePickerOptions}
              >
                <Text className='text-gray-500'>
                  {images.length > 0 ? 'Добавить еще изображения' : 'Нажмите, чтобы добавить изображения'}
                </Text>
              </TouchableOpacity>
            </View>



            <View className='mb-4'>
              <CheckboxGroup
                value={is_need_notification}
                onChange={(keys) => {
                  setIs_need_notification(keys as ['is_need_notification'] | [])
                }}
                className="mb-3"
              >
                <Checkbox size="lg" value="is_need_notification">
                  <CheckboxIndicator>
                    <CheckboxIcon as={CheckIcon} />
                  </CheckboxIndicator>
                  <CheckboxLabel style={{ fontSize: globalFontSize }}>Уведомить о решении</CheckboxLabel>
                </Checkbox>
              </CheckboxGroup>
            </View>
            
            <View className='mt-2 border-t border-gray-200'>
              <Button
                onPress={handleSubmit}
                variant="outline"
                className="rounded-lg border-gray-200 justify-center items-center w-full h-auto bg-primary-main"
              >
                <ButtonText className="p-3 color-white" style={{ fontSize: globalFontSize }}>
                  Отправить
                </ButtonText>
              </Button>
            </View>
          </ScrollView>

          {/* Компонент полноэкранного просмотра */}
          <ImageViewing
            images={images}
            imageIndex={currentImageIndex}
            visible={isImageViewerOpen}
            onRequestClose={() => setIsImageViewerOpen(false)}
          />
          
        </View>

        <View className='w-full h-20' />
        
      </BottomSheetScrollView>
    </BottomSheet>
  )
};

export default CreateFeedbackModal;