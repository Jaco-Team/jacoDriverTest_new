import React, { useRef, useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useFeedbackStore } from '@/shared/store/store';

import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import ImageViewing from 'react-native-image-viewing';

import { useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import { StatusBadge } from './StatusBadge'
import { TypeBadge } from './TypeBadge'

const ViewFeedbackModal: React.FC = () => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const { modal, closeViewModal } = useFeedbackStore();
  const { isViewModalOpen, selectedFeedback } = modal;

  // Состояние для полноэкранного просмотра
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  let [ globalFontSize ] = useGlobalStore( useShallow( state => [ state.globalFontSize ]) );

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index < 0) {
        closeViewModal()
      }
    },
    [closeViewModal]
  )

  // Функция открытия полноэкранного просмотра
  const openImageViewer = (index: number) => {
    setCurrentImageIndex(index);
    setIsImageViewerOpen(true);
  };

  // Предположим, что selectedFeedback?.images — это массив объектов с { uri: string }
  // Если у вас другая структура, подстройте ее
  const images = selectedFeedback?.images ?? [];

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={ isViewModalOpen ? 2 : -1 } 
      snapPoints={['80%', '50%', '25%']} // ['50%', '25%']
      enablePanDownToClose    // позволяет свайпом вниз закрыть
      backdropComponent={BottomSheetBackdrop} // полу-прозрачный фон
      onChange={ handleSheetChanges }
      style={{ zIndex: 1000 }}
      backgroundStyle={{ borderRadius: 30, backgroundColor: '#fff' }}
    >
      <BottomSheetScrollView className='flex bg-white rounded-md' style={{zIndex: 30}}>
        <View className='flex-1 bg-white rounded-t-3xl'>
          <View className='p-4 border-b border-gray-200'>
            <View className='flex-row justify-between items-center'>
              <Text className='leading-7 font-bold' style={{ fontSize: globalFontSize }}>{selectedFeedback?.title}</Text>
            </View>
          </View>

          <ScrollView className='flex-1'>
            <View className='p-4'>
              <View className='flex-row items-center mt-0'>
                <StatusBadge status={selectedFeedback?.status ?? 'Новое'} globalFontSize={globalFontSize} />
                <View className='ml-2'>
                  <TypeBadge type={selectedFeedback?.type ?? 'предложение'} globalFontSize={globalFontSize} />
                </View>
              </View>

              <View className='mb-4 mt-5'>
                <Text className='text-gray-500 leading-7 pb-2' style={{ fontSize: globalFontSize }}>Описание</Text>
                <Text className='leading-7' style={{ fontSize: globalFontSize }}>{selectedFeedback?.description}</Text>
              </View>

              <View className='mb-4 mt-5'>
                <Text className='text-gray-500 leading-7 pb-2' style={{ fontSize: globalFontSize }}>Ответ</Text>
                <Text className='leading-7' style={{ fontSize: globalFontSize }}>{selectedFeedback?.answer}</Text>
              </View>

              <View className='mb-4'>
                <Text className='text-gray-500 leading-7 pb-2' style={{ fontSize: globalFontSize }}>Дата создания</Text>
                <Text className='leading-7' style={{ fontSize: globalFontSize }}>
                  {new Date(selectedFeedback?.date_time_create ?? '').toLocaleString('ru')}
                </Text>
              </View>

              {/* Блок для отображения картинок */}
              {images.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {images.map((img, index) => (
                    <TouchableOpacity
                      key={index}
                      style={{ marginRight: 8, marginBottom: 8 }}
                      onPress={() => openImageViewer(index)}
                    >
                      <Image
                        source={{ uri: img.uri }}
                        style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: '#eee' }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Компонент полноэкранного просмотра */}
              <ImageViewing
                images={images}
                imageIndex={currentImageIndex}
                visible={isImageViewerOpen}
                onRequestClose={() => setIsImageViewerOpen(false)}
              />

            </View>
          </ScrollView>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  )
};

export default ViewFeedbackModal;