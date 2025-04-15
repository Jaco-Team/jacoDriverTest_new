import { useState, useCallback } from 'react'
import { useFocusEffect, useNavigation, ParamListBase } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { useLoginStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'

export function useAuthLogic() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

  // Берём нужные методы/значения из zustand:
  const [check_token, auth] = useLoginStore(
    useShallow((state) => [state.check_token, state.auth])
  )
  const [showModalText] = useGlobalStore(
    useShallow((state) => [state.showModalText])
  )

  // Локальные стейты для логина/пароля и переключения видимости пароля
  const [myLogin, setMyLogin] = useState('')
  const [myPWD, setMyPWD] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // useFocusEffect: при фокусе экрана проверяем токен
  useFocusEffect(
    useCallback(() => {
      const check = async () => {
        const token = await check_token()
        if (token === true) {
          navigation.navigate('List_orders')
        } else {
          navigation.navigate('Auth') // остаёмся на Auth
        }
      }
      check()
    }, [check_token, navigation])
  )

  // Переключение видимости пароля
  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev)
  }

  // Функция логина
  async function LogIn(login: string, pwd: string) {
    if (login.length === 0 || pwd.length === 0) {
      showModalText(true, 'Номер телефона или пароль не должны быть пустыми')
      return
    }
    const res = await auth(login, pwd)
    if (res.st === true) {
      navigation.navigate('List_orders')
    }
  }

  const GoToResetPWD = () => {
    navigation.navigate('ResetPwd');
  }

  return {
    myLogin,
    setMyLogin,
    myPWD,
    setMyPWD,
    showPassword,
    handleTogglePassword,
    LogIn,
    GoToResetPWD
  }
}