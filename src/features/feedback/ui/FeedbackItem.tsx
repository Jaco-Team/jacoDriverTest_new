import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FeedbackResponse } from '@/shared/store/FeedbackStoreType';

import { useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import { StatusBadge } from './StatusBadge'
import { TypeBadge } from './TypeBadge'

interface FeedbackItemProps {
  feedback: FeedbackResponse;
  onPress: () => void;
}

const FeedbackItem: React.FC<FeedbackItemProps> = ({ feedback, onPress }) => {
  let [ globalFontSize ] = useGlobalStore( useShallow( state => [ state.globalFontSize ]) );

  globalFontSize = globalFontSize - 2;

  // <View className='ml-2'>
  //   <TypeBadge type={feedback.type} globalFontSize={globalFontSize} />
  // </View>

  return (
    <TouchableOpacity 
      className='bg-white m-5 p-4 mb-0 border-b border-gray-200 rounded-lg shadow-zinc-500 shadow'
      onPress={onPress}
    >
      <View className='flex-row justify-between items-start'>
        <View className='flex-1'>
          <Text className='font-semibold text-gray-800 text-lg mb-1' style={{ fontSize: globalFontSize }}>{feedback.title}</Text>
          <Text 
            className='text-gray-600 mb-2'
            numberOfLines={2}
            style={{ fontSize: globalFontSize }}
          >
            {feedback.description}
          </Text>
          
          <View className='flex-row items-center mt-2'>
            <StatusBadge status={feedback.status} globalFontSize={globalFontSize} />
            
            <Text className='text-gray-500 leading-5 ml-auto' style={{ fontSize: globalFontSize }}>
              {new Date(feedback.date_time_create).toLocaleDateString('ru')}
            </Text>
          </View>
        </View>
        
        
      </View>
    </TouchableOpacity>
  );
};

export default FeedbackItem;