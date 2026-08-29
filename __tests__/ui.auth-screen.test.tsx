import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react-native'

const mockLogIn = jest.fn()
const mockGoToResetPwd = jest.fn()
const mockHandleLoginChange = jest.fn()
const mockHandlePasswordChange = jest.fn()
const mockHandleTogglePassword = jest.fn()

let mockAuthState: any

jest.mock('@/features/auth/model/useAuthLogic', () => ({
  useAuthLogic: () => mockAuthState,
}))

jest.mock('@/shared/ui/auth/AuthScreenLayout', () => {
  const React = require('react')
  const { View } = require('react-native')
  const AuthScreenLayout = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, { testID: 'auth-screen-layout' }, children)

  return { AuthScreenLayout }
})

import { AuthScreen } from '@/features/auth/ui/AuthScreen'

describe('AuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthState = {
      myLogin: '',
      handleLoginChange: mockHandleLoginChange,
      myPWD: '',
      handlePasswordChange: mockHandlePasswordChange,
      showPassword: false,
      handleTogglePassword: mockHandleTogglePassword,
      captchaRequired: false,
      loginError: '',
      isLoading: false,
      LogIn: mockLogIn,
      GoToResetPWD: mockGoToResetPwd,
    }
  })

  afterEach(async () => {
    await cleanup()
  })

  it('показывает композицию сайта, hint и согласованные заглушки', async () => {
    const screen = await render(<AuthScreen />)

    expect(screen.getByTestId('auth-logo')).toBeTruthy()
    expect(screen.getByText('АВТОРИЗАЦИЯ')).toBeTruthy()
    expect(screen.getByText('Вход в аккаунт')).toBeTruthy()
    expect(screen.getByTestId('auth-login-input')).toBeTruthy()
    expect(screen.getByTestId('auth-password-input')).toBeTruthy()
    expect(screen.getByTestId('auth-hint')).toBeTruthy()
    expect(screen.queryByTestId('auth-error')).toBeNull()
    expect(screen.queryByTestId('auth-captcha-placeholder')).toBeNull()

    const sso = screen.getByTestId('auth-sso-placeholder')
    expect(sso.props.accessibilityState).toEqual({ disabled: true })
    expect(sso.props.disabled).toBe(true)
  })

  it('условно показывает визуальную CAPTCHA после требования API', async () => {
    mockAuthState.captchaRequired = true

    const screen = await render(<AuthScreen />)

    expect(screen.getByTestId('auth-captcha-placeholder')).toBeTruthy()
  })

  it('передаёт ввод, переключение пароля, вход и восстановление в текущую логику', async () => {
    mockAuthState.myLogin = '79990000000'
    mockAuthState.myPWD = '123456'

    const screen = await render(<AuthScreen />)

    await fireEvent.changeText(screen.getByTestId('auth-login-input'), '78880000000')
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), '654321')
    await fireEvent.press(screen.getByTestId('auth-password-toggle'))
    await fireEvent.press(screen.getByTestId('auth-submit'))
    await fireEvent.press(screen.getByTestId('auth-reset-password'))

    expect(mockHandleLoginChange).toHaveBeenCalledWith('78880000000')
    expect(mockHandlePasswordChange).toHaveBeenCalledWith('654321')
    expect(mockHandleTogglePassword).toHaveBeenCalledTimes(1)
    expect(mockLogIn).toHaveBeenCalledWith('79990000000', '123456')
    expect(mockGoToResetPwd).toHaveBeenCalledTimes(1)
  })

  it('заменяет hint на inline-ошибку сервера', async () => {
    mockAuthState.loginError = 'Неверный пароль'

    const screen = await render(<AuthScreen />)

    expect(screen.queryByTestId('auth-hint')).toBeNull()
    expect(screen.getByTestId('auth-error')).toBeTruthy()
    expect(screen.getByText('Неверный пароль')).toBeTruthy()
  })

  it('блокирует повторное нажатие во время входа', async () => {
    mockAuthState.isLoading = true

    const screen = await render(<AuthScreen />)
    const submit = screen.getByTestId('auth-submit')

    expect(submit.props.accessibilityState).toEqual({ busy: true, disabled: true })
    expect(submit.props.disabled).toBe(true)
  })
})
