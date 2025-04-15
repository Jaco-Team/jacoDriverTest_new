import React from 'react'
import { View } from 'react-native'
import { useNavigation, ParamListBase } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { Image } from '@/components/ui/image'
import { Input, InputField, InputSlot, InputIcon } from '@/components/ui/input'
import { EyeIcon, EyeOffIcon } from '@/components/ui/icon'
import { Button, ButtonText } from '@/components/ui/button'

import { useResetPwdLogic } from '../model/useResetPwdLogic'

import { ScreenLayout } from '@/shared/ui/ScreenLayout'
import { KeyboardAvoidingLayout } from '@/shared/ui/KeyboardAvoidingLayout'

export function ResetPwdScreen(): React.JSX.Element {
  const {
    activeStep,
    myCode,
    setMyCode,
    myLogin,
    setMyLogin,
    myPWD,
    setMyPWD,
    showPassword,
    handleTogglePassword,
    sendsms,
    check_code
  } = useResetPwdLogic()

  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

  return (
    <ScreenLayout>
      <Image
        className="absolute w-full min-h-[500px] top-0"
        source={require('@/shared/assets/wallpaper.png')}
        alt="image"
      />

      {activeStep === 1 ? null : (
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
                  placeholder="Новый пароль"
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
                onPress={() => sendsms(myLogin, myPWD)}
              >
                <ButtonText className="text-typography-0">Дальше</ButtonText>
              </Button>

              <Button
                className="w-full mt-5 text-right"
                size="xl"
                variant="link"
                onPress={() => {
                  navigation.navigate('Auth')
                }}
              >
                <ButtonText className="text-primary-main">Вернуться к авторизации</ButtonText>
              </Button>
            </>
          </KeyboardAvoidingLayout>
        </View>
      )}

      {activeStep === 0 ? null : (
        <View className="p-5 mt-32 h-full w-full justify-center bg-transparent">
          <KeyboardAvoidingLayout>
            <>
              <Input
                variant="outline"
                size="xl"
                isInvalid={false}
                isRequired={true}
                isDisabled={true}
                className="bg-white rounded-lg"
              >
                <InputField
                  placeholder="Номер телефона"
                  type="text"
                  value={myLogin}
                  onChange={(event) => setMyLogin(event.nativeEvent.text)}
                />
              </Input>

              <Input className="mt-5 bg-white rounded-lg" variant="outline" size="xl" isInvalid={false} isRequired>
                <InputField
                  placeholder="Код из смс"
                  type="text"
                  value={myCode}
                  onChange={(event) => setMyCode(event.nativeEvent.text)}
                />
              </Input>

              <Button
                className="w-full mt-5 bg-primary-main rounded-lg"
                size="xl"
                onPress={() => check_code(myLogin, myCode)}
              >
                <ButtonText className="text-typography-0">Подтвердить</ButtonText>
              </Button>

              <Button
                className="w-full mt-5 text-right"
                size="xl"
                variant="link"
                onPress={() => {
                  navigation.navigate('Auth')
                }}
              >
                <ButtonText className="text-primary-main">Вернуться к авторизации</ButtonText>
              </Button>
            </>
          </KeyboardAvoidingLayout>
        </View>
      )}
    </ScreenLayout>
  )
}