import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect, useNavigation, ParamListBase } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Keyboard, Linking } from 'react-native'
import { InAppBrowser } from 'react-native-inappbrowser-reborn'

import { useLoginStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'

import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';
import {RU_SCREEN_NAMES} from '@/app/navigation/types';
import { laravelApiConfig } from '@/shared/api/laravel/config'

import { parseSsoCallbackUrl } from './ssoCallback'

export function useAuthLogic() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

  // Берём нужные методы/значения из zustand:
  const [check_token, auth, authWithSsoCode, isLoading] = useLoginStore(
    useShallow((state) => [
      state.check_token,
      state.auth,
      state.authWithSsoCode,
      state.is_load,
    ])
  )

  // Локальные стейты для логина/пароля и переключения видимости пароля
  const [myLogin, setMyLogin] = useState('')
  const [myPWD, setMyPWD] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const handledSsoUrl = useRef('')

  const finishSuccessfulLogin = useCallback(() => {
    setMyLogin('')
    setMyPWD('')
    setShowPassword(false)
    setCaptchaRequired(false)
    setCaptchaToken('')
    setLoginError('')

    const title = RU_SCREEN_NAMES['List_orders'] ?? 'Список заказов';
    Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${title}`);
    navigation.reset({ index: 0, routes: [{ name: 'List_orders' }] })
  }, [navigation])

  const handleSsoUrl = useCallback(async (url: string) => {
    const callback = parseSsoCallbackUrl(url)

    if (!callback.handled || handledSsoUrl.current === url) {
      return
    }

    handledSsoUrl.current = url

    if (callback.error) {
      setLoginError(callback.error)
      Analytics.log(AnalyticsEvent.AuthLoginFail, 'Ошибка авторизации через SSO');
      return
    }

    const result = await authWithSsoCode(callback.loginCode)

    if (result.st === true) {
      Analytics.log(AnalyticsEvent.AuthLogin, 'Успешная авторизация через SSO');
      finishSuccessfulLogin()
    } else {
      setLoginError(result.text || 'Не удалось выполнить вход через SSO.')
      Analytics.log(AnalyticsEvent.AuthLoginFail, 'Ошибка авторизации через SSO');
    }
  }, [authWithSsoCode, finishSuccessfulLogin])

  // useFocusEffect: при фокусе экрана проверяем токен
  useFocusEffect(
    useCallback(() => {
      const check = async () => {
        const token = await check_token()
        if (token === true) {
          const title = RU_SCREEN_NAMES['List_orders'] ?? 'Список заказов';
          Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${title}`);

          navigation.reset({ index: 0, routes: [{ name: 'List_orders' }] })
        }
      }
      check()
    }, [check_token, navigation])
  )

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleSsoUrl(url)
    })

    void Linking.getInitialURL()
      .then((url) => {
        if (url) {
          void handleSsoUrl(url)
        }
      })
      .catch(() => undefined)

    return () => {
      subscription.remove()
    }
  }, [handleSsoUrl])

  // Переключение видимости пароля
  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev)
  }

  const handleLoginChange = (value: string) => {
    setMyLogin(value)
  }

  const handlePasswordChange = (value: string) => {
    setMyPWD(value)
  }

  // Функция логина
  async function LogIn(login: string, pwd: string) {
    Keyboard.dismiss()

    if (login.length === 0 || pwd.length === 0) {
      return
    }

    setLoginError('')

    if (captchaRequired && !captchaToken) {
      setLoginError('Пройдите CAPTCHA, чтобы продолжить.')
      return
    }

    const submittedCaptchaToken = captchaToken
    const res = await auth(login, pwd, submittedCaptchaToken)
    if (res.captcha_required === true) {
      setCaptchaRequired(true)
      setCaptchaToken('')
      setCaptchaResetKey((currentValue) => currentValue + 1)
    }

    if (res.st === true) {
      Analytics.log(AnalyticsEvent.AuthLogin, 'Успешная авторизация');

      finishSuccessfulLogin()
    } else {
      const errorText = res.captcha_required === true && !submittedCaptchaToken
        ? 'Пройдите CAPTCHA, чтобы продолжить.'
        : res.text || 'Не удалось войти. Проверьте номер телефона и пароль.'

      setLoginError(errorText)
      Analytics.log(AnalyticsEvent.AuthLoginFail, 'Ошибка авторизации');
    }
  }

  const GoToResetPWD = () => {
    Analytics.log(AnalyticsEvent.AuthGoToResetPwd, 'Восстановление пароля');
    navigation.navigate('ResetPwd');
  }

  const LoginWithSSO = async () => {
    Keyboard.dismiss()
    setLoginError('')

    try {
      if (await InAppBrowser.isAvailable()) {
        const result = await InAppBrowser.openAuth(
          laravelApiConfig.ssoLoginUrl,
          laravelApiConfig.ssoCallbackUrl,
          {
            ephemeralWebSession: false,
            showTitle: false,
            enableUrlBarHiding: true,
            enableDefaultShare: false,
            forceCloseOnRedirection: true,
          },
        )

        if (result.type === 'success') {
          await handleSsoUrl(result.url)
        }
        return
      }

      await Linking.openURL(laravelApiConfig.ssoLoginUrl)
    } catch {
      setLoginError('Не удалось открыть вход через SSO.')
      Analytics.log(AnalyticsEvent.AuthLoginFail, 'Ошибка открытия SSO');
    }
  }

  const handleCaptchaTokenChange = (token: string) => {
    setCaptchaToken(token)
    if (token) {
      setLoginError('')
    }
  }

  const handleCaptchaError = (message: string) => {
    setCaptchaToken('')
    setLoginError(message)
  }

  return {
    myLogin,
    handleLoginChange,
    myPWD,
    handlePasswordChange,
    showPassword,
    handleTogglePassword,
    captchaRequired,
    captchaResetKey,
    handleCaptchaTokenChange,
    handleCaptchaError,
    loginError,
    isLoading,
    LogIn,
    LoginWithSSO,
    GoToResetPWD
  }
}
