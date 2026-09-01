import { useState, useCallback } from 'react'
import { useFocusEffect, useNavigation, ParamListBase } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { useLoginStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'

import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';
import {RU_SCREEN_NAMES} from '@/app/navigation/types';

export function useAuthLogic() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

  // Берём нужные методы/значения из zustand:
  const [check_token, auth, isLoading] = useLoginStore(
    useShallow((state) => [state.check_token, state.auth, state.is_load])
  )

  // Локальные стейты для логина/пароля и переключения видимости пароля
  const [myLogin, setMyLogin] = useState('')
  const [myPWD, setMyPWD] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [captchaRequired, setCaptchaRequired] = useState(false)

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
    if (login.length === 0 || pwd.length === 0) {
      return
    }

    setLoginError('')

    const res = await auth(login, pwd)
    if (res.captcha_required === true) {
      setCaptchaRequired(true)
    }

    if (res.st === true) {
      Analytics.log(AnalyticsEvent.AuthLogin, 'Успешная авторизация');

      // Auth остаётся смонтированным в drawer после перехода к заказам.
      // Очищаем чувствительные данные до навигации, чтобы они не появились
      // повторно при выходе из аккаунта.
      setMyLogin('')
      setMyPWD('')
      setShowPassword(false)
      setCaptchaRequired(false)

      const title = RU_SCREEN_NAMES['List_orders'] ?? 'Список заказов';
      Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${title}`);

      navigation.reset({ index: 0, routes: [{ name: 'List_orders' }] })
    } else {
      setLoginError(res.text || 'Не удалось войти. Проверьте номер телефона и пароль.')
      Analytics.log(AnalyticsEvent.AuthLoginFail, 'Ошибка авторизации');
    }
  }

  const GoToResetPWD = () => {
    Analytics.log(AnalyticsEvent.AuthGoToResetPwd, 'Восстановление пароля');
    navigation.navigate('ResetPwd');
  }

  return {
    myLogin,
    handleLoginChange,
    myPWD,
    handlePasswordChange,
    showPassword,
    handleTogglePassword,
    captchaRequired,
    loginError,
    isLoading,
    LogIn,
    GoToResetPWD
  }
}
