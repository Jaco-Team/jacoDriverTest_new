import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react-native'

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

jest.mock('@/shared/ui/auth/AuthSmartCaptcha', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    AuthSmartCaptcha: ({ testID }: { testID: string }) =>
      React.createElement(View, { testID }),
  }
})

import { ResetPwdScreen } from '@/features/reset-pwd/ui/ResetPwdScreen'

function baseState(overrides: Record<string, unknown> = {}) {
  return {
    step: 'request',
    loading: false,
    phone: '',
    setPhone: jest.fn(),
    phoneError: '',
    maskedPhone: '',
    channels: ['sms', 'telegram', 'voice'],
    channel: 'sms',
    setChannel: jest.fn(),
    code: '',
    setCode: jest.fn(),
    password: '',
    setPassword: jest.fn(),
    repeatPassword: '',
    setRepeatPassword: jest.fn(),
    passwordRules: { length: false, characters: false, match: false },
    error: null,
    recoveryMessage: '',
    captchaVisible: false,
    captchaResetKey: 0,
    handleCaptchaTokenChange: jest.fn(),
    handleCaptchaError: jest.fn(),
    resendAfter: 0,
    retryAfter: 0,
    canSubmit: false,
    submit: jest.fn(),
    resend: jest.fn(),
    back: jest.fn(),
    editPhone: jest.fn(),
    changeChannel: jest.fn(),
    goToLogin: jest.fn(),
    ...overrides,
  }
}

describe('ResetPwdScreen: те же шаги, что на странице входа SSO', () => {
  beforeEach(() => {
    mockResetState = baseState()
  })

  afterEach(async () => {
    await cleanup()
  })

  it('шаг номера: поле, способ получения кода с подписью и возврат ко входу', async () => {
    const screen = await render(<ResetPwdScreen />)

    expect(screen.getByTestId('reset-title')).toHaveTextContent('Восстановление пароля')
    expect(screen.getByText('Отправим код подтверждения на ваш номер')).toBeTruthy()
    expect(screen.getByTestId('auth-logo')).toBeTruthy()
    expect(screen.queryByTestId('auth-back')).toBeNull()
    expect(screen.getByTestId('reset-login-input').props.placeholder).toBe('+7 (999) 123-45-67')

    expect(screen.getByTestId('auth-channel-sms').props.accessibilityState).toMatchObject({ selected: true })
    expect(screen.getByTestId('auth-channel-helper')).toHaveTextContent('Придёт SMS с 6-значным кодом')
    await fireEvent.press(screen.getByTestId('auth-channel-voice'))
    expect(mockResetState.setChannel).toHaveBeenCalledWith('voice')

    await fireEvent.changeText(screen.getByTestId('reset-login-input'), '79991234567')
    expect(mockResetState.setPhone).toHaveBeenCalledWith('79991234567')

    const submit = screen.getByTestId('reset-submit')
    expect(submit).toHaveTextContent('Отправить код')
    expect(submit.props.accessibilityState).toEqual({ busy: false, disabled: true })

    await fireEvent.press(screen.getByTestId('reset-return-to-auth'))
    expect(mockResetState.goToLogin).toHaveBeenCalledTimes(1)
  })

  it('не показывает переключатель, когда доступна только SMS, и показывает ошибку номера', async () => {
    mockResetState = baseState({
      channels: ['sms'],
      phoneError: 'Аккаунт с таким номером не найден.',
      captchaVisible: true,
    })

    const screen = await render(<ResetPwdScreen />)

    expect(screen.queryByTestId('auth-channel-switch')).toBeNull()
    expect(screen.getByTestId('reset-phone-error')).toHaveTextContent('Аккаунт с таким номером не найден.')
    expect(screen.getByTestId('reset-captcha')).toBeTruthy()
  })

  it('шаг кода: номер под маской, шесть ячеек, отсчёт повторной отправки', async () => {
    mockResetState = baseState({
      step: 'code',
      maskedPhone: '+7 (999) ***-**-67',
      code: '12',
      resendAfter: 29,
      recoveryMessage: 'Запрос на отправку кода принят.',
      canSubmit: false,
    })

    const screen = await render(<ResetPwdScreen />)

    expect(screen.getByTestId('reset-title')).toHaveTextContent('Введите код')
    expect(screen.getByTestId('reset-masked-phone')).toHaveTextContent('+7 (999) ***-**-67')
    expect(screen.queryByTestId('auth-logo')).toBeNull()
    expect(screen.getByTestId('reset-code-input-cell-0')).toHaveTextContent('1')
    expect(screen.getByTestId('reset-code-input-cell-1')).toHaveTextContent('2')
    expect(screen.getByTestId('reset-code-input-cell-5')).toHaveTextContent('')
    expect(screen.getByTestId('reset-resend-wait')).toHaveTextContent('Отправить повторно через 0:29')
    expect(screen.queryByTestId('reset-resend')).toBeNull()
    expect(screen.getByTestId('reset-message')).toHaveTextContent('Запрос на отправку кода принят.')
    expect(screen.getByTestId('reset-submit')).toHaveTextContent('Подтвердить')

    await fireEvent.changeText(screen.getByTestId('reset-code-input'), '12a345')
    expect(mockResetState.setCode).toHaveBeenCalledWith('12345')

    await fireEvent.press(screen.getByTestId('auth-back'))
    await fireEvent.press(screen.getByTestId('reset-edit-phone'))
    await fireEvent.press(screen.getByTestId('reset-change-channel'))
    expect(mockResetState.back).toHaveBeenCalledTimes(1)
    expect(mockResetState.editPhone).toHaveBeenCalledTimes(1)
    expect(mockResetState.changeChannel).toHaveBeenCalledTimes(1)
  })

  it('после ожидания предлагает отправить код снова и показывает отказ по коду с заголовком', async () => {
    mockResetState = baseState({
      step: 'code',
      maskedPhone: '+7 (999) ***-**-67',
      error: { text: 'Код не подошёл или устарел', code: true },
      recoveryMessage: 'Запрос на отправку кода принят.',
    })

    const screen = await render(<ResetPwdScreen />)

    expect(screen.getByTestId('reset-error')).toHaveTextContent('Неверный кодКод не подошёл или устарел')
    // Пояснение об отправке уступает место ошибке.
    expect(screen.queryByTestId('reset-message')).toBeNull()

    await fireEvent.press(screen.getByTestId('reset-resend'))
    expect(mockResetState.resend).toHaveBeenCalledTimes(1)
  })

  it('шаг пароля: два поля со своими кнопками показа и три требования', async () => {
    mockResetState = baseState({
      step: 'password',
      password: 'NewPassword9',
      repeatPassword: 'NewPassword',
      passwordRules: { length: true, characters: true, match: false },
      retryAfter: 20,
    })

    const screen = await render(<ResetPwdScreen />)

    expect(screen.getByTestId('reset-title')).toHaveTextContent('Придумайте новый пароль')
    expect(screen.getByText('Используйте строчные и заглавные латинские буквы и цифры')).toBeTruthy()
    expect(screen.getByTestId('reset-password-input').props.secureTextEntry).toBe(true)
    expect(screen.getByTestId('reset-repeat-password-input').props.secureTextEntry).toBe(true)

    await fireEvent.press(screen.getByTestId('reset-password-input-toggle'))
    expect(screen.getByTestId('reset-password-input').props.secureTextEntry).toBe(false)
    expect(screen.getByTestId('reset-repeat-password-input').props.secureTextEntry).toBe(true)

    expect(screen.getByTestId('auth-password-rule-length').props.accessibilityLabel).toBe(
      'Не менее 8 символов — выполнено',
    )
    expect(screen.getByTestId('auth-password-rule-match').props.accessibilityLabel).toBe(
      'Пароли совпадают — не выполнено',
    )
    expect(screen.getByTestId('reset-countdown')).toHaveTextContent('Повторите через 0:20')
    expect(screen.getByTestId('reset-submit')).toHaveTextContent('Сохранить пароль')

    await fireEvent.changeText(screen.getByTestId('reset-repeat-password-input'), 'NewPassword9')
    expect(mockResetState.setRepeatPassword).toHaveBeenCalledWith('NewPassword9')
  })

  it('шаг «готово»: значок успеха и вход с новым паролем', async () => {
    mockResetState = baseState({ step: 'success', canSubmit: true })

    const screen = await render(<ResetPwdScreen />)

    expect(screen.getByTestId('reset-title')).toHaveTextContent('Пароль изменён')
    expect(screen.getByText('Теперь вы можете войти с новым паролем')).toBeTruthy()
    expect(screen.getByTestId('auth-success-icon')).toBeTruthy()
    expect(screen.queryByTestId('reset-return-to-auth')).toBeNull()

    const submit = screen.getByTestId('reset-submit')
    expect(submit).toHaveTextContent('Войти')
    await fireEvent.press(submit)
    expect(mockResetState.submit).toHaveBeenCalledTimes(1)
  })

  it('во время запроса кнопка занята, а поля недоступны', async () => {
    mockResetState = baseState({ loading: true, phone: '+7 (999) 123-45-67' })

    const screen = await render(<ResetPwdScreen />)

    expect(screen.getByTestId('reset-submit').props.accessibilityState).toEqual({ busy: true, disabled: true })
    expect(screen.getByTestId('reset-login-input').props.editable).toBe(false)
  })
})
