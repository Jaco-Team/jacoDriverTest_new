import React from 'react'
import { View } from 'react-native'

import { Image } from '@/components/ui/image'
import { Input, InputField, InputSlot, InputIcon } from '@/components/ui/input'
import { EyeIcon, EyeOffIcon } from '@/components/ui/icon'
import { Button, ButtonText } from '@/components/ui/button'

import { useAuthLogic } from '../model/useAuthLogic'

import { ScreenLayout } from '@/shared/ui/ScreenLayout'
import { KeyboardAvoidingLayout } from '@/shared/ui/KeyboardAvoidingLayout'

export function AuthScreen(): React.JSX.Element {
  const {
    myLogin,
    setMyLogin,
    myPWD,
    setMyPWD,
    showPassword,
    handleTogglePassword,
    LogIn,
    GoToResetPWD
  } = useAuthLogic()

  return (
    <ScreenLayout>
      <Image
        className="absolute w-full min-h-[500px] top-0"
        source={require('@/shared/assets/wallpaper.png')}
        alt="image"
      />

      <View className="p-5 mt-32 h-full w-full justify-center bg-transparent">
        <KeyboardAvoidingLayout>
          <>
            <Input variant="outline" size="xl" isInvalid={false} isRequired className="bg-white rounded-lg">
              <InputField
                placeholder="Номер телефона"
                type="text"
                value={myLogin}
                onChange={(event) => setMyLogin(event.nativeEvent.text)}
              />
            </Input>

            <Input className="mt-5 bg-white rounded-lg" variant="outline" size="xl" isInvalid={false} isRequired>
              <InputField
                placeholder="Пароль"
                type={showPassword ? 'text' : 'password'}
                value={myPWD}
                onChange={(event) => setMyPWD(event.nativeEvent.text)}
              />
              <InputSlot className="pr-3" onPress={handleTogglePassword}>
                <InputIcon as={showPassword ? EyeIcon : EyeOffIcon} />
              </InputSlot>
            </Input>

            <Button
              className="w-full mt-5 bg-primary-main rounded-lg"
              size="xl"
              onPress={() => LogIn(myLogin, myPWD)}
            >
              <ButtonText className="text-typography-0">Войти</ButtonText>
            </Button>

            <Button
              className="w-full mt-5 text-right rounded-lg"
              size="xl"
              variant="link"
              onPress={GoToResetPWD}
            >
              <ButtonText className="text-primary-main">Восстановить пароль</ButtonText>
            </Button>
          </>
        </KeyboardAvoidingLayout>
      </View>
    </ScreenLayout>
  )
}