import { useState, useCallback, useRef, useEffect } from 'react';

import { useFeedbackStore, useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import BottomSheet from '@gorhom/bottom-sheet'

import { FeedbackType } from '@/shared/store/FeedbackStoreType';

import { 
  Alert
} from 'react-native';

import {
  launchImageLibrary,
  launchCamera,
  ImagePickerResponse,
  Asset,
  ImageLibraryOptions,
  CameraOptions,
} from 'react-native-image-picker';

export function useCreateFeedbackModal() {
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [ modal, closeCreateModal, createFeedback, isSaving ] = useFeedbackStore( useShallow( state => [ state.modal, state.closeCreateModal, state.createFeedback, state.is_click ]) );
  const { isCreateModalOpen } = modal;

  const [ globalFontSize, showModalText ] = useGlobalStore( useShallow( state => [ state.globalFontSize, state.showModalText ]) );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<FeedbackType>('предложение');
  const [isNeedNotification, setIsNeedNotification] = useState(false)
  const [images, setImages] = useState<Asset[]>([]);

  const handleSubmit = () => {
    if (isSaving) return

    if (!title.trim()) {
      showModalText(true, 'Пожалуйста, введите заголовок')
      return;
    }

    if (!description.trim()) {
      showModalText(true, 'Пожалуйста, введите описание')
      return;
    }

    //console.log( 'images', images )

    createFeedback({
      title,
      description,
      type,
      is_need_notification: isNeedNotification ? 1 : 0,
      images: images
    });
  };

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setType('предложение');
    setIsNeedNotification(false);
    setImages([]);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    closeCreateModal();
  }, [closeCreateModal, resetForm]);

  const feedbackTypes: FeedbackType[] = ['предложение', 'ошибка', 'улучшение', 'другое'];

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index < 0) {
        handleClose()
      }
    },
    [handleClose]
  )

  useEffect(() => {
    if(!isCreateModalOpen) {
      bottomSheetRef.current?.close();
    }
  }, [isCreateModalOpen]);

  const handleImagePickerResponse = (response: ImagePickerResponse) => {
    if (response.didCancel) {
      console.log('Пользователь отменил выбор изображения');
      return;
    }
    
    if (response.errorCode) {
      console.log('ImagePicker Error: ', response.errorMessage);
      Alert.alert('Ошибка', response.errorMessage || 'Произошла ошибка при выборе изображения');
      return;
    }
    
    if (response.assets && response.assets.length > 0) {
      // Добавляем новые изображения к существующим
      setImages(prevImages => [...prevImages, ...response.assets as Asset[]]);
    }
  };

  const pickImageFromGallery = () => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
      selectionLimit: 0,
    };
    
    launchImageLibrary(options, handleImagePickerResponse);
  };

  const takePhoto = () => {
    const options: CameraOptions = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
      saveToPhotos: true,
    };
    
    launchCamera(options, handleImagePickerResponse);
  };

  const showImagePickerOptions = () => {
    // Alert.alert(
    //   'Добавить изображение',
    //   'Выберите источник',
    //   [
    //     {text: 'Отмена', style: 'cancel'},
    //     {text: 'Галерея', onPress: pickImageFromGallery},
    //     {text: 'Камера', onPress: takePhoto},
    //   ]
    // );
    pickImageFromGallery();
  };

  const removeImage = (index: number) => {
    setImages(prevImages => prevImages.filter((_, idx) => idx !== index));
  };

  return {
    bottomSheetRef, 
    isCreateModalOpen, 
    modal, 
    closeCreateModal, 
    createFeedback,
    globalFontSize,
    title, setTitle,
    description, setDescription,
    type, setType,
    isNeedNotification, setIsNeedNotification,
    isSaving,
    handleSubmit,
    feedbackTypes,
    handleSheetChanges,
    resetForm,
    handleClose,
    images, setImages,
    handleImagePickerResponse,
    pickImageFromGallery,
    takePhoto,
    showImagePickerOptions,
    removeImage,
  }
}
