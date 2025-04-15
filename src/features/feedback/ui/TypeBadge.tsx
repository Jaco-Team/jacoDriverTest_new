import React from 'react';
import { View, Text } from 'react-native';
import { FeedbackResponse } from '@/shared/store/FeedbackStoreType';

export const TypeBadge: React.FC<{ type: FeedbackResponse['type'], globalFontSize: number }> = ({ type, globalFontSize }) => {
  const getTypeStyle = () => {
    switch (type) {
      case 'предложение':
        return 'bg-purple-100 text-purple-800';
      case 'ошибка':
        return 'bg-red-100 text-red-800';
      case 'улучшение':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <View className={`rounded-full py-2 px-4 pt-1.5 ${getTypeStyle()}`}>
      <Text className='leading-7 font-medium' style={{ fontSize: globalFontSize }}>{type}</Text>
    </View>
  );
};