import React from 'react';
import { View, Text } from 'react-native';
import { FeedbackResponse } from '@/shared/store/FeedbackStoreType';

export const StatusBadge: React.FC<{ status: FeedbackResponse['status'], globalFontSize: number }> = ({ status, globalFontSize }) => {
  const getStatusStyle = () => {
    switch (status) {
      case 'Новое':
        return 'bg-blue-100 text-blue-800';
      case 'В работе':
        return 'bg-yellow-100 text-yellow-800';
      case 'Решено':
        return 'bg-green-100 text-green-800';
      case 'Отклонено':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <View className={`rounded-full py-2 px-4 pt-1.5 ${getStatusStyle()}`}>
      <Text className='leading-7 font-medium' style={{ fontSize: globalFontSize }}>{status}</Text>
    </View>
  );
};