import React, {useEffect, useRef, useState} from 'react';
import {Image, Platform, Pressable, Text, View} from 'react-native';
import ImageView from 'react-native-image-viewing';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useErrorOrders} from '../model/useErrorModal';
import type {GraphErrOrder} from '@/shared/store/StatStoreType';
import {
  GraphAppealBlock,
  GraphErrorField,
  GraphErrorSheetContainer,
  graphErrorSheetStyles,
  type GraphErrorScrollHandle,
} from './GraphErrorSheetParts';

interface ModalErrOrderPreview {
  isOpen: boolean;
  data: GraphErrOrder;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export function ModalErrOrder({
  preview,
}: {
  preview?: ModalErrOrderPreview;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const {
    isShowModalErrOrder,
    modalErrOrder,
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
    submitError,
  } = useErrorOrders();
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

  const activeModal = preview?.data ?? modalErrOrder;
  const activeErrorText = preview ? previewErrorText : errorText;
  const activeImages = preview ? [] : transformedArray;
  const activeSubmitting = preview ? false : isSubmitting;
  const handleClose = preview?.onClose ?? closeModal;
  const handleSubmit = preview
    ? () => preview.onSubmit(previewErrorText)
    : submitError;
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
        isOpen={preview?.isOpen ?? isShowModalErrOrder}
        testPrefix="graph-order-error"
        onClose={handleClose}
        onScrollRef={instance => {
          scrollRef.current = instance;
        }}>
        <Text style={[graphErrorSheetStyles.title, {fontSize: globalFontSize}]}>
          Ошибка по заказу №{activeModal?.order_id}
        </Text>
        <GraphErrorField
          fontSize={globalFontSize}
          label="Дата заказа:"
          value={activeModal?.date_time_order}
        />
        <GraphErrorField
          fontSize={globalFontSize}
          label="Ошибка заказа:"
          value={activeModal?.order_desc}
        />
        <GraphErrorField
          fontSize={globalFontSize}
          label="Позиция:"
          value={activeModal?.item_name}
        />
        <GraphErrorField
          fontSize={globalFontSize}
          label="Ошибка:"
          value={activeModal?.pr_name}
        />
        <GraphErrorField
          fontSize={globalFontSize}
          label="Сумма:"
          value={`${FormatPrice(activeModal?.my_price || 0)}₽`}
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
          text={activeModal?.new_text_1}
          value={activeErrorText}
          onChange={preview ? setPreviewErrorText : setTextError}
          onInputFocus={keepAppealVisible}
          onSubmit={handleSubmit}
        />
        {!activeModal?.new_text_2 ? null : (
          <GraphErrorField
            fontSize={globalFontSize}
            label="Ответ обжалования:"
            value={activeModal.new_text_2}
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
