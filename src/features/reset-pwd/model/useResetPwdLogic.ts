import { useCallback, useState } from 'react'
import { ParamListBase, useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useShallow } from 'zustand/react/shallow'

import { Analytics, AnalyticsEvent } from '@/analytics/AppMetricaService'
import { RU_SCREEN_NAMES } from '@/app/navigation/types'
import {
  isPasswordStrong,
  stripPasswordSpaces,
} from '@/shared/lib/passwordRequirements'
import { useLoginStore } from '@/shared/store/store'

type RecoveryStep = 0 | 1

export function useResetPwdLogic() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
  const [checkToken, sendSMS, sendCode, isLoading] = useLoginStore(
    useShallow((state) => [
      state.check_token,
      state.sendSMS,
      state.sendCode,
      state.is_load,
    ])
  )

  const [activeStep, setActiveStep] = useState<RecoveryStep>(0)
  const [myCode, setMyCode] = useState('')
  const [myLogin, setMyLogin] = useState('')
  const [myPWD, setMyPWD] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)

  const isPasswordValid = isPasswordStrong(myPWD)
  const canRequestCode =
    myLogin.trim().length > 0 && isPasswordValid && captchaToken.length > 0 && !isLoading
  const canConfirmCode = myCode.length === 6 && !isLoading

  const resetRecoveryState = useCallback(() => {
    setActiveStep(0)
    setMyCode('')
    setMyLogin('')
    setMyPWD('')
    setShowPassword(false)
    setErrorText('')
    setCaptchaToken('')
    setCaptchaResetKey((currentValue) => currentValue + 1)
  }, [])

  useFocusEffect(
    useCallback(() => {
      let isFocused = true

      const check = async () => {
        const token = await checkToken()
        if (isFocused && token === true) {
          navigation.reset({ index: 0, routes: [{ name: 'List_orders' }] })
        }
      }

      void check()

      return () => {
        isFocused = false
        resetRecoveryState()
      }
    }, [checkToken, navigation, resetRecoveryState])
  )

  function handleLoginChange(value: string): void {
    setMyLogin(value)
    setErrorText('')
  }

  function handlePasswordChange(value: string): void {
    setMyPWD(stripPasswordSpaces(value))
    setErrorText('')
  }

  function handleCodeChange(value: string): void {
    setMyCode(value.replace(/\D/g, '').slice(0, 6))
    setErrorText('')
  }

  function handleTogglePassword(): void {
    setShowPassword((currentValue) => !currentValue)
  }

  async function requestRecoveryCode(): Promise<void> {
    if (!myLogin.trim()) {
      setErrorText('Введите номер телефона.')
      return
    }

    if (!isPasswordValid) {
      setErrorText('Новый пароль должен соответствовать всем требованиям.')
      return
    }

    if (!captchaToken) {
      setErrorText('Пройдите CAPTCHA, чтобы продолжить.')
      return
    }

    setErrorText('')
    const result = await sendSMS(myLogin, myPWD, captchaToken)
    setCaptchaToken('')
    setCaptchaResetKey((currentValue) => currentValue + 1)

    if (result.st === true) {
      setActiveStep(1)
      return
    }

    setErrorText(result.text || 'Не удалось отправить код восстановления.')
  }

  async function confirmRecoveryCode(): Promise<void> {
    if (myCode.length !== 6) {
      setErrorText('Введите шестизначный код из SMS.')
      return
    }

    setErrorText('')
    const result = await sendCode(myLogin, myCode, myPWD)

    if (result.st === true) {
      const title = RU_SCREEN_NAMES.List_orders ?? 'Список заказов'
      Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${title}`)
      navigation.reset({ index: 0, routes: [{ name: 'List_orders' }] })
      return
    }

    setErrorText(result.text || 'Не удалось подтвердить код восстановления.')
  }

  function goToAuth(): void {
    Analytics.log(AnalyticsEvent.ScreenOpen, 'Открытие страницы Авторизации')
    navigation.navigate('Auth')
  }

  function handleCaptchaTokenChange(token: string): void {
    setCaptchaToken(token)
    if (token) {
      setErrorText('')
    }
  }

  function handleCaptchaError(message: string): void {
    setCaptchaToken('')
    setErrorText(message)
  }

  const panelTitle =
    activeStep === 0 ? 'Восстановление доступа' : 'Подтверждение по SMS'
  const panelText =
    activeStep === 0
      ? 'Укажите номер телефона и новый пароль. После этого мы отправим код подтверждения.'
      : 'Введите код из SMS, чтобы подтвердить номер и завершить восстановление пароля.'
  const helperText =
    activeStep === 0
      ? 'Если номер зарегистрирован, отправим SMS с кодом. Пароль должен быть сложным.'
      : 'Если код не пришел, проверьте номер телефона и повторите отправку позже.'

  return {
    activeStep,
    panelTitle,
    panelText,
    helperText,
    myCode,
    handleCodeChange,
    myLogin,
    handleLoginChange,
    myPWD,
    handlePasswordChange,
    showPassword,
    handleTogglePassword,
    errorText,
    captchaResetKey,
    handleCaptchaTokenChange,
    handleCaptchaError,
    isPasswordValid,
    isLoading,
    canRequestCode,
    canConfirmCode,
    requestRecoveryCode,
    confirmRecoveryCode,
    goToAuth,
  }
}
