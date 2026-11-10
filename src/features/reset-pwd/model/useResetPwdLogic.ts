import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { ParamListBase, useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useShallow } from 'zustand/react/shallow'

import { Analytics, AnalyticsEvent } from '@/analytics/AppMetricaService'
import { RU_SCREEN_NAMES } from '@/app/navigation/types'
import {
  fetchLaravelRecoveryOptions,
  requestLaravelRecoveryCode,
  resetLaravelPasswordWithCode,
  type LaravelRecoveryChannel,
} from '@/shared/api/laravel/auth'
import { stripPasswordSpaces } from '@/shared/lib/passwordRequirements'
import { maskPhone, parsePhoneInput, PHONE_FORMAT_ERROR } from '@/shared/lib/phoneInput'
import { useLoginStore } from '@/shared/store/store'
import { AUTH_CODE_LENGTH } from '@/shared/ui/auth/AuthSsoKit'

export type RecoveryStep = 'request' | 'code' | 'password' | 'success'

export interface RecoveryError {
  text: string
  /** Ошибка относится к коду: показываем заголовок «Неверный код» и подсвечиваем ячейки. */
  code: boolean
}

function remainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

/**
 * Восстановление пароля тем же сценарием, что на странице входа SSO и в ШЭФ:
 * номер и способ получения кода → код → новый пароль → готово. Код сервер
 * проверяет вместе с новым паролем, одним запросом.
 */
export function useResetPwdLogic() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
  const [checkToken, auth] = useLoginStore(
    useShallow((state) => [state.check_token, state.auth])
  )

  const [step, setStep] = useState<RecoveryStep>('request')
  const [loading, setLoading] = useState(false)
  const [phone, setPhoneState] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [phoneServerError, setPhoneServerError] = useState('')
  const [channels, setChannels] = useState<LaravelRecoveryChannel[]>(['sms'])
  const [channel, setChannel] = useState<LaravelRecoveryChannel>('sms')
  const [code, setCodeState] = useState('')
  const [password, setPasswordState] = useState('')
  const [repeatPassword, setRepeatPasswordState] = useState('')
  const [error, setError] = useState<RecoveryError | null>(null)
  const [recoveryMessage, setRecoveryMessage] = useState('')
  // Пока сервер не ответил, какая проверка нужна, CAPTCHA считается обязательной.
  const [captchaRequired, setCaptchaRequired] = useState(true)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const [resendUntil, setResendUntil] = useState(0)
  const [retryUntil, setRetryUntil] = useState(0)
  const [now, setNow] = useState(Date.now)

  const inFlight = useRef(false)
  // Смена сеанса отбрасывает ответы, пришедшие после ухода с экрана.
  const session = useRef(0)

  const resetRecoveryState = useCallback(() => {
    session.current += 1
    inFlight.current = false
    setStep('request')
    setLoading(false)
    setPhoneState('')
    setPhoneTouched(false)
    setPhoneServerError('')
    setChannel('sms')
    setCodeState('')
    setPasswordState('')
    setRepeatPasswordState('')
    setError(null)
    setRecoveryMessage('')
    setCaptchaToken('')
    setCaptchaResetKey((key) => key + 1)
    setResendUntil(0)
    setRetryUntil(0)
    setNow(Date.now())
  }, [])

  useFocusEffect(
    useCallback(() => {
      let isFocused = true
      const current = session.current

      void checkToken().then((token) => {
        if (isFocused && token === true) {
          navigation.reset({ index: 0, routes: [{ name: 'List_orders' }] })
        }
      })

      void fetchLaravelRecoveryOptions().then((options) => {
        if (!isFocused || session.current !== current) return
        setChannels(options.channels)
        setChannel((selected) => (options.channels.includes(selected) ? selected : options.channels[0]))
        setCaptchaRequired(options.captchaRequired)
      })

      return () => {
        isFocused = false
        resetRecoveryState()
      }
    }, [checkToken, navigation, resetRecoveryState])
  )

  useEffect(() => {
    const lastDeadline = Math.max(resendUntil, retryUntil)

    if (lastDeadline <= Date.now()) return undefined

    const timer = setInterval(() => setNow(Date.now()), 1000)

    return () => clearInterval(timer)
  }, [resendUntil, retryUntil])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now())
    })

    return () => subscription.remove()
  }, [])

  const parsedPhone = parsePhoneInput(phone)
  const resendAfter = remainingSeconds(resendUntil, now)
  const retryAfter = remainingSeconds(retryUntil, now)
  const passwordRules = {
    length: password.length >= 8,
    characters: /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password),
    match: password.length > 0 && password === repeatPassword,
  }
  const captchaVisible = captchaRequired && (step === 'request' || step === 'code')
  const captchaSatisfied = !captchaRequired || captchaToken.length > 0

  function startWait(setDeadline: (value: number) => void, seconds: number): void {
    const current = Date.now()

    setDeadline(seconds > 0 ? current + seconds * 1000 : 0)
    setNow(current)
  }

  function resetCaptcha(): void {
    setCaptchaToken('')
    setCaptchaResetKey((key) => key + 1)
  }

  function setPhone(value: string): void {
    setPhoneState(parsePhoneInput(value).display)
    setPhoneServerError('')
    if (error) setError(null)
  }

  function setCode(value: string): void {
    setCodeState(value.replace(/\D/g, '').slice(0, AUTH_CODE_LENGTH))
    if (error) setError(null)
  }

  function setPassword(value: string): void {
    setPasswordState(stripPasswordSpaces(value))
    if (error) setError(null)
  }

  function setRepeatPassword(value: string): void {
    setRepeatPasswordState(stripPasswordSpaces(value))
    if (error) setError(null)
  }

  function clearRecoveryInputs(): void {
    setCodeState('')
    setPasswordState('')
    setRepeatPasswordState('')
  }

  async function sendCode(): Promise<void> {
    if (inFlight.current) return

    if (!parsedPhone.valid) {
      setPhoneTouched(true)
      return
    }

    if (remainingSeconds(resendUntil, Date.now()) > 0) return

    if (!captchaSatisfied) {
      setError({ text: 'Пройдите CAPTCHA, чтобы продолжить.', code: false })
      return
    }

    inFlight.current = true
    const current = session.current

    setLoading(true)
    setError(null)

    const result = await requestLaravelRecoveryCode(
      parsedPhone.apiValue,
      channel,
      captchaRequired ? captchaToken : '',
    )

    if (session.current !== current) return

    inFlight.current = false
    setLoading(false)
    resetCaptcha()
    if (result.captchaRequired) setCaptchaRequired(true)

    if (result.st) {
      Analytics.log(AnalyticsEvent.AuthSendSms, 'Отправка кода восстановления')
      setRecoveryMessage(result.text)
      startWait(setResendUntil, result.resendAfter)
      startWait(setRetryUntil, 0)
      clearRecoveryInputs()
      setStep('code')
      return
    }

    Analytics.log(AnalyticsEvent.AuthSendSmsFail, 'Ошибка отправки кода восстановления')
    startWait(setResendUntil, result.retryAfter)

    if (result.errorCode === 'account_not_found') {
      // Как в ШЭФ: неизвестный номер показываем под полем и возвращаем к его вводу.
      setPhoneServerError(result.text)
      setPhoneTouched(true)
      setRecoveryMessage('')
      clearRecoveryInputs()
      setStep('request')
      return
    }

    setError({ text: result.text, code: false })
  }

  function confirmCode(): void {
    if (code.length !== AUTH_CODE_LENGTH) {
      setError({ text: 'Введите 6 цифр кода', code: false })
      return
    }

    // Код проверяется сервером вместе с новым паролем, одним действием.
    setError(null)
    setStep('password')
  }

  async function savePassword(): Promise<void> {
    if (inFlight.current || !passwordRules.length || !passwordRules.characters || !passwordRules.match) {
      return
    }

    inFlight.current = true
    const current = session.current

    setLoading(true)
    setError(null)

    const result = await resetLaravelPasswordWithCode(parsedPhone.apiValue, code, password)

    if (session.current !== current) return

    inFlight.current = false
    setLoading(false)

    if (result.st) {
      setCodeState('')
      setStep('success')
      return
    }

    if (result.errorCode === 'invalid_code' || result.errorCode === 'too_many_attempts') {
      // После исчерпания попыток помогает только новый код: возвращаем к его вводу.
      setCodeState('')
      setError({ text: result.text, code: result.errorCode === 'invalid_code' })
      setStep('code')
      return
    }

    startWait(setRetryUntil, result.retryAfter)
    setError({ text: result.text, code: false })
  }

  async function loginWithNewPassword(): Promise<void> {
    if (inFlight.current) return

    inFlight.current = true
    const current = session.current

    setLoading(true)

    const result = await auth(parsedPhone.apiValue, password)

    if (session.current !== current) return

    inFlight.current = false
    setLoading(false)

    if (result.st === true) {
      const title = RU_SCREEN_NAMES.List_orders ?? 'Список заказов'

      Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${title}`)
      navigation.reset({ index: 0, routes: [{ name: 'List_orders' }] })
    } else {
      goToLogin()
    }
  }

  function goToLogin(): void {
    Analytics.log(AnalyticsEvent.ScreenOpen, 'Открытие страницы Авторизации')
    navigation.navigate('Auth')
  }

  function submit(): void {
    if (loading) return

    if (step === 'request') void sendCode()
    else if (step === 'code') confirmCode()
    else if (step === 'password') void savePassword()
    else void loginWithNewPassword()
  }

  function back(): void {
    if (loading) return

    setError(null)
    setStep(step === 'password' ? 'code' : 'request')
  }

  function editPhone(): void {
    if (loading) return

    setError(null)
    clearRecoveryInputs()
    setStep('request')
  }

  const canSubmit =
    !loading &&
    (step === 'request'
      ? parsedPhone.valid && resendAfter <= 0 && captchaSatisfied
      : step === 'code'
        ? code.length === AUTH_CODE_LENGTH
        : step === 'password'
          ? passwordRules.length && passwordRules.characters && passwordRules.match && retryAfter <= 0
          : true)

  return {
    step,
    loading,
    phone,
    setPhone,
    phoneError: phoneServerError || (phoneTouched && !parsedPhone.valid ? PHONE_FORMAT_ERROR : ''),
    maskedPhone: parsedPhone.valid ? maskPhone(phone) : '',
    channels,
    channel,
    setChannel,
    code,
    setCode,
    password,
    setPassword,
    repeatPassword,
    setRepeatPassword,
    passwordRules,
    error,
    recoveryMessage,
    captchaVisible,
    captchaResetKey,
    handleCaptchaTokenChange: (token: string) => setCaptchaToken(token),
    handleCaptchaError: (message: string) => {
      setCaptchaToken('')
      setError({ text: message, code: false })
    },
    resendAfter,
    retryAfter,
    canSubmit,
    submit,
    resend: () => {
      if (!loading) void sendCode()
    },
    back,
    editPhone,
    changeChannel: editPhone,
    goToLogin,
  }
}
