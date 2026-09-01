import React, {useEffect, useRef, useState} from 'react';
import {Image, Platform, Pressable, Text, View} from 'react-native';
import ImageView from 'react-native-image-viewing';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useErrorCamera} from '../model/useErrorModal';
import type {GraphErrCam} from '@/shared/store/StatStoreType';
import {
  GraphAppealBlock,
  GraphErrorField,
  GraphErrorSheetContainer,
  graphErrorSheetStyles,
  type GraphErrorScrollHandle,
} from './GraphErrorSheetParts';

interface ModalErrCamPreview {
  isOpen: boolean;
  data: GraphErrCam;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export function ModalErrCam({
  preview,
}: {
  preview?: ModalErrCamPreview;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const {
    isShowModalErrCam,
    modalErrCam,
    FormatPrice,
    isSubmitting,
    globalFontSize,
    visible,
    setVisible,
    indexImg,
    transformedArray,
    errorText,
    setTextError,
    closeModal,
    openImage,
    onSubmitError,
  } = useErrorCamera();
  const [previewErrorText, setPreviewErrorText] = useState('');
  const scrollRef = useRef<GraphErrorScrollHandle | null>(null);
  const focusScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (preview?.isOpen) setPreviewErrorText('');
  }, [preview?.data, preview?.isOpen]);

  useEffect(
    () => () => {
      if (focusScrollTimer.current) clearTimeout(focusScrollTimer.current);
    },
    [],
  );

  const activeModal = preview?.data ?? modalErrCam;
  const activeErrorText = preview ? previewErrorText : errorText;
  const activeImages = preview ? [] : transformedArray;
  const activeSubmitting = preview ? false : isSubmitting;
  const handleClose = preview?.onClose ?? closeModal;
  const handleSubmit = preview
    ? () => preview.onSubmit(previewErrorText)
    : onSubmitError;
  const keepAppealVisible = () => {
    if (Platform.OS === 'ios') return;

    if (focusScrollTimer.current) clearTimeout(focusScrollTimer.current);
    focusScrollTimer.current = setTimeout(() => {
      scrollRef.current?.scrollToEnd({animated: true});
    }, 250);
  };

  return (
    <>
      <GraphErrorSheetContainer
        bottomInset={insets.bottom}
        busy={activeSubmitting}
        isOpen={preview?.isOpen ?? isShowModalErrCam}
        testPrefix="graph-camera-error"
        onClose={handleClose}
        onScrollRef={instance => {
          scrollRef.current = instance;
        }}>
        <Text style={[graphErrorSheetStyles.title, {fontSize: globalFontSize}]}>
          Ошибка №{activeModal?.id}
        </Text>
        <GraphErrorField
          fontSize={globalFontSize}
          label="Дата время ошибки:"
          value={activeModal?.date_time_fine}
        />
        <GraphErrorField
          fontSize={globalFontSize}
          label="Ошибка:"
          value={activeModal?.fine_name}
        />
        <GraphErrorField
          fontSize={globalFontSize}
          label="Сумма:"
          value={`${FormatPrice(activeModal?.price || 0)}₽`}
        />

        {activeImages.length === 0 ? null : (
          <>
            <GraphErrorField fontSize={globalFontSize} label="Фото" value="" />
            <View style={graphErrorSheetStyles.images}>
              {activeImages.map((image, index) => (
                <Pressable
                  key={`${image.uri}-${index}`}
                  style={graphErrorSheetStyles.imageButton}
                  onPress={() => openImage(index)}>
                  <Image
                    resizeMode="contain"
                    source={image}
                    style={graphErrorSheetStyles.image}
                  />
                </Pressable>
              ))}
            </View>
          </>
        )}

        <GraphAppealBlock
          busy={activeSubmitting}
          canEdit={activeModal?.is_edit !== 0}
          fontSize={globalFontSize}
          text={activeModal?.text_one}
          value={activeErrorText}
          onChange={preview ? setPreviewErrorText : setTextError}
          onInputFocus={keepAppealVisible}
          onSubmit={handleSubmit}
        />
        {!activeModal?.text_two ? null : (
          <GraphErrorField
            fontSize={globalFontSize}
            label="Ответ обжалования:"
            value={activeModal.text_two}
          />
        )}
      </GraphErrorSheetContainer>

      <ImageView
        imageIndex={indexImg}
        images={activeImages}
        visible={visible}
        onRequestClose={() => setVisible(false)}
      />
    </>
  );
}
