import { useState, useCallback } from 'react'
import { useFocusEffect, useNavigation, ParamListBase } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { useLoginStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'

export function useResetPwdLogic() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

  // Методы из zustand
  const [check_token, sendSMS, sendCode] = useLoginStore(
    useShallow((state) => [state.check_token, state.sendSMS, state.sendCode])
  )
  const [showModalText] = useGlobalStore(
    useShallow((state) => [state.showModalText])
  )

  // Локальные стейты
  const [activeStep, setActiveStep] = useState(0)
  const [myCode, setMyCode] = useState('')
  const [myLogin, setMyLogin] = useState('')
  const [myPWD, setMyPWD] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // useFocusEffect: при фокусе проверяем токен
  useFocusEffect(
    useCallback(() => {
      const check = async () => {
        const token = await check_token()
        if (token === true) {
          navigation.navigate('List_orders')
        }
      }
      check()
    }, [check_token, navigation])
  )

  // Переключение видимости пароля
  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev)
  }

  // Отправить SMS
  async function sendsms(login: string, pwd: string) {
    if (login.length === 0 || pwd.length === 0) {
      showModalText(true, 'Номер телефона или пароль не должны быть пустыми')
      return
    }
    const res = await sendSMS(login, pwd)
    if (res.st === true) {
      setActiveStep(1)
    }
  }

  // Проверить код
  async function check_code(login: string, code: string) {
    if (code.length !== 4) {
      return
    }
    const res = await sendCode(login, code)
    if (res.st) {
      navigation.navigate('List_orders')
    }
  }

  return {
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
  }
}