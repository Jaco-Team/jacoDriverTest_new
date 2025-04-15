import React, { useEffect, useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';

import FeedbackItem from './FeedbackItem';

import { useFeedbackStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

const FeedbackList: React.FC = () => {
  const [ feedbacks, fetchFeedbacks, openViewModal, chooseStatus, searchQuery, fetchFeedbackById ] = useFeedbackStore( useShallow( state => [ state.feedbacks, state.fetchFeedbacks, state.openViewModal, state.chooseStatus, state.searchQuery, state.fetchFeedbackById ]) );

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((feedback) => {
      const matchesSearch = 
        feedback.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feedback.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = chooseStatus == '' || feedback.status == chooseStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, chooseStatus, feedbacks]);

  return (
    <View className='flex-1'>
      <FlatList
        refreshing={false}
        onRefresh={() => fetchFeedbacks()}
        removeClippedSubviews={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        data={filteredFeedbacks}
        keyExtractor={(item) => item.id+""}
        renderItem={({ item }) => (
          <FeedbackItem feedback={item} onPress={() => fetchFeedbackById(item.id)} />
        )}
        ListFooterComponent={() => <View className='h-20'></View>}
        ListEmptyComponent={
          <View className='flex-1 items-center justify-center p-12 shadow-zinc-0 shadow'>
            <Text className='text-gray-500 text-lg text-center'>
              Нет предложений. Будьте первым, кто внесет предложение!
            </Text>
          </View>
        }
      />
    </View>
  );
};

export default FeedbackList;