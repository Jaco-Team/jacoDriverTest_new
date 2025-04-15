import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useFeedbackStore } from '@/shared/store/store';
import { FeedbackStatus } from '@/shared/store/FeedbackStoreType';
import FeedbackList from './FeedbackList';
import ViewFeedbackModal from './ViewFeedbackModal';
import CreateFeedbackModal from './CreateFeedbackModal';

import { useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import { ScreenLayout } from '@/shared/ui/ScreenLayout'

import { Search } from "lucide-react-native";
import { Input, InputField, InputSlot, InputIcon } from "@/components/ui/input"

export const FeedbackScreen: React.FC = () => {
  const [ globalFontSize ] = useGlobalStore( useShallow( state => [ state.globalFontSize ]) );

  const [ modal, openCreateModal, setStatus, chooseStatus, searchQuery, setSearchQuery ] = useFeedbackStore( useShallow( state => [ state.modal, state.openCreateModal, state.setStatus, state.chooseStatus, state.searchQuery, state.setSearchQuery ]) );

  const { isCreateModalOpen, isViewModalOpen } = modal;

  const feedbackStatus: FeedbackStatus[] = ['Новое', 'В работе', 'Отклонено', 'Решено'];

  return (
    <ScreenLayout>
      
      <View className='flex-1'>
        <View className='m-5 mb-0'>
          <Text className='text-gray-700 mb-1 font-medium' style={{ fontSize: globalFontSize }}>Статус</Text>
          <ScrollView className='flex-row flex-wrap pt-2' horizontal={true} showsHorizontalScrollIndicator={false}>
            {feedbackStatus.map((status) => (
              <TouchableOpacity
                key={status}
                className={`mr-2 mb-2 rounded-full py-2 px-4 pt-1.5 ${chooseStatus === status ? 'bg-primary-main' : 'bg-gray-200'}`}
                onPress={() => setStatus(chooseStatus == status ? '' : status)}
              >
                <Text className={`leading-7 ${chooseStatus === status ? 'text-white' : 'text-gray-800'}`} style={{ fontSize: globalFontSize }}>
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View className="mb-5 mt-5">
            
            <Input
              variant="outline"
              size="xl"
              className='rounded-lg'
              
            >
              <InputSlot className="pl-3">
                <InputIcon as={Search} />
              </InputSlot>
              <InputField 
                type='text'
                value={searchQuery}
                onChangeText={(text) => setSearchQuery(text)}
                placeholder="Поиск отзывов..." 
              />
            </Input>
            
          </View>
        </View>

        <FeedbackList />
        
        <ViewFeedbackModal />
        <CreateFeedbackModal />
      </View>

      { !(isCreateModalOpen || isViewModalOpen) && 
        <TouchableOpacity
          className='absolute bottom-6 right-6 bg-primary-main w-14 h-14 rounded-full items-center justify-center shadow-lg'
          onPress={openCreateModal}
        >
          <Text className='text-white text-2xl font-bold'>+</Text>
        </TouchableOpacity>
      }
    </ScreenLayout>
  );
};