import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
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
import { positiveRecoverySeconds } from '@/shared/api/laravel/errors'

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
  const [recoveryComplete, setRecoveryComplete] = useState(false)
  const [myCode, setMyCode] = useState('')
  const [myLogin, setMyLogin] = useState('')
  const [myPWD, setMyPWD] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [captchaRequired, setCaptchaRequired] = useState(true)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const [showResendCaptcha, setShowResendCaptcha] = useState(false)
  const [sendRetryUntil, setSendRetryUntil] = useState(0)
  const [confirmRetryUntil, setConfirmRetryUntil] = useState(0)
  const [now, setNow] = useState(Date.now)
  const sendInFlight = useRef(false)
  const confirmInFlight = useRef(false)
  const recoverySession = useRef(0)
  const recoveryFinished = useRef(false)
  const sendBlockedUntil = useRef(0)
  const confirmBlockedUntil = useRef(0)

  const sendRetryAfter = Math.max(0, Math.ceil((sendRetryUntil - now) / 1000))
  const confirmRetryAfter = Math.max(0, Math.ceil((confirmRetryUntil - now) / 1000))
  const retryAfter = activeStep === 0 ? sendRetryAfter : confirmRetryAfter

  useEffect(() => {
    if (Math.max(sendRetryUntil, confirmRetryUntil) <= Date.now()) return
    const timer = setInterval(() => {
      const currentTime = Date.now()
      setNow(currentTime)
      if (Math.max(sendRetryUntil, confirmRetryUntil) <= currentTime) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [sendRetryUntil, confirmRetryUntil])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now())
    })
    return () => subscription.remove()
  }, [])

  const isPasswordValid = isPasswordStrong(myPWD)
  const canRequestCode =
    myLogin.trim().length > 0 && isPasswordValid &&
    (!captchaRequired || captchaToken.length > 0) && !isLoading &&
    sendRetryAfter === 0 && !recoveryComplete
  const canConfirmCode = myCode.length === 6 && !isLoading && !recoveryComplete && confirmRetryAfter === 0

  const resetRecoveryState = useCallback(() => {
    recoverySession.current += 1
    recoveryFinished.current = false
    sendBlockedUntil.current = 0
    confirmBlockedUntil.current = 0
    sendInFlight.current = false
    confirmInFlight.current = false
    setSendRetryUntil(0)
    setConfirmRetryUntil(0)
    setNow(Date.now())
    setCaptchaRequired(true)
    setShowResendCaptcha(false)
    setActiveStep(0)
    setRecoveryComplete(false)
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
    if (isLoading || recoveryFinished.current || recoveryComplete ||
      sendInFlight.current || confirmInFlight.current || sendBlockedUntil.current > Date.now()) return

    if (!myLogin.trim()) {
      setErrorText('Введите номер телефона.')
      return
    }

    if (!isPasswordValid) {
      setErrorText('Новый пароль должен соответствовать всем требованиям.')
      return
    }

    if (captchaRequired && !captchaToken) {
      if (activeStep === 1) {
        setShowResendCaptcha(true)
        setErrorText('')
      } else {
        setErrorText('Пройдите CAPTCHA, чтобы продолжить.')
      }
      return
    }

    sendInFlight.current = true
    const session = recoverySession.current
    const submittedLogin = myLogin
    const submittedPassword = myPWD
    const submittedCaptchaToken = captchaToken
    setErrorText('')
    try {
      const result = await sendSMS(submittedLogin, submittedPassword, submittedCaptchaToken)
      if (session !== recoverySession.current) return

      if (typeof result.captcha_required === 'boolean') {
        setCaptchaRequired(result.captcha_required)
      }
      if (submittedCaptchaToken || result.captcha_required === true) {
        setCaptchaToken('')
        setCaptchaResetKey((currentValue) => currentValue + 1)
      }
      const defaultWait = result.st === true
        ? positiveRecoverySeconds(result.resend_after) ?? 30
        : result.locked === true ? 30 : undefined
      const waitSeconds = positiveRecoverySeconds(result.retry_after) ?? defaultWait
      if (waitSeconds) {
        const currentTime = Date.now()
        setNow(currentTime)
        sendBlockedUntil.current = currentTime + waitSeconds * 1000
        setSendRetryUntil(sendBlockedUntil.current)
      }

      if (result.st === true) {
        setMyLogin(submittedLogin)
        setMyPWD(submittedPassword)
        setMyCode('')
        setShowResendCaptcha(false)
        confirmBlockedUntil.current = 0
        setConfirmRetryUntil(0)
        setActiveStep(1)
        return
      }

      setErrorText(result.text || 'Не удалось отправить код восстановления.')
    } catch {
      if (session === recoverySession.current) {
        setErrorText('Не удалось отправить код восстановления. Повторите позже.')
      }
    } finally {
      if (session === recoverySession.current) sendInFlight.current = false
    }
  }

  async function confirmRecoveryCode(): Promise<void> {
    if (isLoading || recoveryFinished.current || recoveryComplete ||
      confirmInFlight.current || sendInFlight.current || confirmBlockedUntil.current > Date.now()) return

    if (myCode.length !== 6) {
      setErrorText('Введите шестизначный код из SMS.')
      return
    }

    confirmInFlight.current = true
    const session = recoverySession.current
    setErrorText('')
    try {
      const result = await sendCode(myLogin, myCode, myPWD)
      if (session !== recoverySession.current) return

      if (result.st === true) {
        recoveryFinished.current = true
        const title = RU_SCREEN_NAMES.List_orders ?? 'Список заказов'
        Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${title}`)
        navigation.reset({ index: 0, routes: [{ name: 'List_orders' }] })
        return
      }

      if (result.password_changed === true) {
        recoveryFinished.current = true
        setRecoveryComplete(true)
        setMyCode('')
        setMyPWD('')
        setShowPassword(false)
        return
      }

      const waitSeconds = positiveRecoverySeconds(result.retry_after) ?? (result.locked === true ? 30 : undefined)
      if (waitSeconds) {
        const currentTime = Date.now()
        setNow(currentTime)
        confirmBlockedUntil.current = currentTime + waitSeconds * 1000
        setConfirmRetryUntil(confirmBlockedUntil.current)
      }
      setErrorText(result.text || 'Не удалось подтвердить код восстановления.')
    } catch {
      if (session === recoverySession.current) {
        setErrorText('Не удалось подтвердить код восстановления. Повторите позже.')
      }
    } finally {
      if (session === recoverySession.current) confirmInFlight.current = false
    }
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

  const panelTitle = recoveryComplete
    ? 'Пароль изменён'
    : activeStep === 0
      ? 'Восстановление доступа'
      : 'Подтверждение по SMS'
  const panelText = recoveryComplete
    ? 'Пароль успешно изменён. Теперь войдите в аккаунт с новым паролем.'
    : activeStep === 0
      ? 'Укажите номер телефона и новый пароль. После этого мы отправим код подтверждения.'
      : 'Введите код из SMS, чтобы подтвердить номер и завершить восстановление пароля.'
  const helperText = recoveryComplete
    ? 'При входе может потребоваться CAPTCHA. Повторно вводить SMS-код не нужно.'
    : activeStep === 0
      ? 'Если номер зарегистрирован, отправим SMS с кодом. Пароль должен соответствовать требованиям.'
      : 'Если код не пришел, проверьте номер телефона и повторите отправку позже.'

  return {
    activeStep,
    recoveryComplete,
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
    captchaRequired,
    showResendCaptcha,
    captchaResetKey,
    retryAfter,
    sendRetryAfter,
    canResendCode: activeStep === 1 && myLogin.trim().length > 0 && isPasswordValid &&
      !isLoading && !recoveryComplete && sendRetryAfter === 0 &&
      (!showResendCaptcha || !captchaRequired || captchaToken.length > 0),
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
