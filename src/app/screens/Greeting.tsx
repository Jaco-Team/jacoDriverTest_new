import React from 'react';

import { View, Text } from 'react-native';

import { Image } from '@/components/ui/image';
import { Spinner } from "@/components/ui/spinner"
import { Center } from "@/components/ui/center"

import { useGreetingLogic } from '@/processes/auth/model/useGreetingLogic'

export function Greeting(): React.JSX.Element {
  useGreetingLogic();

  return (
    <View className='h-full w-full relative bg-gray-200'>
      
      <Image 
        className={"absolute w-full min-h-[500px] top-0"}
        source={require('@/shared/assets/wallpaper.png')}
        alt="image"
      /> 
        
      <Center className='w-full h-full mt-64'>
        <Text className='font-roboto font-semibold text-5xl text-center'>Приложение курьера</Text>
        <Text className='font-roboto font-semibold text-3xl'>сети кафе Жако</Text>
      </Center>

      <Center className="absolute w-full h-full mt-20">
        <Spinner size={'large'} />
      </Center>

    </View>
  );
}