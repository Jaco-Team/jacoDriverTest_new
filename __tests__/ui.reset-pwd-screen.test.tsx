import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react-native'

const mockHandleCodeChange = jest.fn()
const mockHandleLoginChange = jest.fn()
const mockHandlePasswordChange = jest.fn()
const mockHandleTogglePassword = jest.fn()
const mockRequestRecoveryCode = jest.fn()
const mockConfirmRecoveryCode = jest.fn()
const mockGoToAuth = jest.fn()

let mockResetState: any

jest.mock('@/features/reset-pwd/model/useResetPwdLogic', () => ({
  useResetPwdLogic: () => mockResetState,
}))

jest.mock('@/shared/ui/auth/AuthScreenLayout', () => {
  const React = require('react')
  const { View } = require('react-native')
  const AuthScreenLayout = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, { testID: 'auth-screen-layout' }, children)

  return { AuthScreenLayout }
})

import { ResetPwdScreen } from '@/features/reset-pwd/ui/ResetPwdScreen'

describe('ResetPwdScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockResetState = {
      activeStep: 0,
      panelTitle: 'Восстановление доступа',
      panelText:
        'Укажите номер телефона и новый пароль. После этого мы отправим код подтверждения.',
      helperText:
        'Если номер зарегистрирован, отправим SMS с кодом. Пароль должен быть сложным.',
      myCode: '',
      handleCodeChange: mockHandleCodeChange,
      myLogin: '',
      handleLoginChange: mockHandleLoginChange,
      myPWD: '',
      handlePasswordChange: mockHandlePasswordChange,
      showPassword: false,
      handleTogglePassword: mockHandleTogglePassword,
      errorText: '',
      isLoading: false,
      canRequestCode: false,
      canConfirmCode: false,
      requestRecoveryCode: mockRequestRecoveryCode,
      confirmRecoveryCode: mockConfirmRecoveryCode,
      goToAuth: mockGoToAuth,
    }
  })

  afterEach(async () => {
    await cleanup()
  })

  it('показывает первый шаг с требованиями пароля и CAPTCHA', async () => {
    const screen = await render(<ResetPwdScreen />)

    expect(screen.getByText('ВОССТАНОВЛЕНИЕ ПАРОЛЯ')).toBeTruthy()
    expect(screen.getByText('Восстановление доступа')).toBeTruthy()
    expect(screen.getByTestId('reset-phone-input')).toBeTruthy()
    expect(screen.getByTestId('reset-password-input')).toBeTruthy()
    expect(screen.getByTestId('reset-password-requirements')).toBeTruthy()
    expect(screen.getByTestId('reset-captcha-placeholder')).toBeTruthy()
    expect(screen.getByTestId('reset-hint')).toBeTruthy()
    expect(screen.getByTestId('reset-submit').props.disabled).toBe(true)
  })

  it('передаёт ввод первого шага и переход к авторизации', async () => {
    mockResetState.canRequestCode = true
    const screen = await render(<ResetPwdScreen />)

    await fireEvent.changeText(screen.getByTestId('reset-phone-input'), '89003270606')
    await fireEvent.changeText(screen.getByTestId('reset-password-input'), 'Password1')
    await fireEvent.press(screen.getByTestId('auth-password-toggle'))
    await fireEvent.press(screen.getByTestId('reset-submit'))
    await fireEvent.press(screen.getByTestId('reset-back-to-auth'))

    expect(mockHandleLoginChange).toHaveBeenCalledWith('89003270606')
    expect(mockHandlePasswordChange).toHaveBeenCalledWith('Password1')
    expect(mockHandleTogglePassword).toHaveBeenCalledTimes(1)
    expect(mockRequestRecoveryCode).toHaveBeenCalledTimes(1)
    expect(mockGoToAuth).toHaveBeenCalledTimes(1)
  })

  it('показывает второй шаг с одним четырёхзначным SMS-инпутом', async () => {
    mockResetState.activeStep = 1
    mockResetState.panelTitle = 'Подтверждение по SMS'
    mockResetState.panelText =
      'Введите код из SMS, чтобы подтвердить номер и завершить восстановление пароля.'
    mockResetState.helperText =
      'Если код не пришел, проверьте номер телефона и повторите отправку позже.'
    mockResetState.myCode = '1107'
    mockResetState.canConfirmCode = true

    const screen = await render(<ResetPwdScreen />)
    const codeInput = screen.getByTestId('reset-code-input')

    expect(screen.getByText('Подтверждение по SMS')).toBeTruthy()
    expect(codeInput.props.maxLength).toBe(4)
    expect(screen.queryByTestId('reset-captcha-placeholder')).toBeNull()

    await fireEvent.changeText(codeInput, '1234')
    await fireEvent.press(screen.getByTestId('reset-submit'))

    expect(mockHandleCodeChange).toHaveBeenCalledWith('1234')
    expect(mockConfirmRecoveryCode).toHaveBeenCalledTimes(1)
  })

  it('заменяет подсказку на inline-ошибку и блокирует кнопку во время запроса', async () => {
    mockResetState.errorText = 'Код из смс введен не верно'
    mockResetState.isLoading = true

    const screen = await render(<ResetPwdScreen />)
    const submit = screen.getByTestId('reset-submit')

    expect(screen.queryByTestId('reset-hint')).toBeNull()
    expect(screen.getByTestId('reset-error')).toBeTruthy()
    expect(screen.getByText('Код из смс введен не верно')).toBeTruthy()
    expect(submit.props.disabled).toBe(true)
    expect(submit.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    })
  })
})
