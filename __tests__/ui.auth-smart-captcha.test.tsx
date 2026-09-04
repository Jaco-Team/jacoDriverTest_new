import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

jest.mock('react-native-webview', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    WebView: (props: any) => React.createElement(View, props),
  }
})

import { laravelApiConfig } from '@/shared/api/laravel/config'
import { AuthSmartCaptcha } from '@/shared/ui/auth/AuthSmartCaptcha'

describe('AuthSmartCaptcha', () => {
  const onError = jest.fn()
  const onTokenChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('загружает доверенную Laravel-страницу и возвращает CAPTCHA token', async () => {
    const screen = await render(
      <AuthSmartCaptcha
        onError={onError}
        onTokenChange={onTokenChange}
        resetKey={0}
        testID="captcha"
      />,
    )
    const webView = screen.getByTestId('captcha-webview')
    const containerStyle = StyleSheet.flatten(screen.getByTestId('captcha').props.style)

    expect(webView.props.source).toEqual({ uri: laravelApiConfig.captchaPageUrl })
    expect(webView.props.originWhitelist).toEqual([
      'https://*',
      'http://localhost:*',
      'http://127.0.0.1:*',
    ])
    expect(containerStyle).toMatchObject({ height: 132, overflow: 'hidden' })
    expect(containerStyle.borderWidth).toBeUndefined()
    expect(screen.getByTestId('captcha-loading')).toBeTruthy()

    await act(async () => {
      webView.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({ type: 'success', token: 'captcha-token' }),
        },
      })
    })

    expect(onTokenChange).toHaveBeenCalledWith('captcha-token')
    expect(onError).not.toHaveBeenCalled()
    expect(screen.queryByTestId('captcha-loading')).toBeNull()
  })

  it('очищает одноразовый token при истечении CAPTCHA', async () => {
    const screen = await render(
      <AuthSmartCaptcha
        onError={onError}
        onTokenChange={onTokenChange}
        resetKey={0}
        testID="captcha"
      />,
    )

    await act(async () => {
      screen.getByTestId('captcha-webview').props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: 'expired' }) },
      })
    })

    expect(onTokenChange).toHaveBeenCalledWith('')
    expect(onError).toHaveBeenCalledWith(
      'Срок действия CAPTCHA истёк. Пройдите проверку ещё раз.',
    )
    expect(screen.getByText('Срок действия CAPTCHA истёк. Пройдите проверку ещё раз.')).toBeTruthy()
  })

  it('повторяет загрузку после ошибки WebView', async () => {
    const screen = await render(
      <AuthSmartCaptcha
        onError={onError}
        onTokenChange={onTokenChange}
        resetKey={0}
        testID="captcha"
      />,
    )

    await act(async () => {
      screen.getByTestId('captcha-webview').props.onError()
    })
    fireEvent.press(screen.getByTestId('captcha-retry'))

    expect(onTokenChange).toHaveBeenLastCalledWith('')
    expect(onError).toHaveBeenLastCalledWith('')
    expect(screen.getByTestId('captcha-loading')).toBeTruthy()
  })

  it('не принимает повреждённые сообщения из WebView', async () => {
    const screen = await render(
      <AuthSmartCaptcha
        onError={onError}
        onTokenChange={onTokenChange}
        resetKey={0}
        testID="captcha"
      />,
    )

    await act(async () => {
      screen.getByTestId('captcha-webview').props.onMessage({
        nativeEvent: { data: 'not-json' },
      })
    })

    expect(onTokenChange).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('скрывает загрузку после ready и обрабатывает ошибку CAPTCHA', async () => {
    const screen = await render(
      <AuthSmartCaptcha
        onError={onError}
        onTokenChange={onTokenChange}
        resetKey={0}
        testID="captcha"
      />,
    )
    const webView = screen.getByTestId('captcha-webview')

    await act(async () => {
      webView.props.onMessage({
        nativeEvent: {data: JSON.stringify({type: 'ready'})},
      })
    })
    expect(screen.queryByTestId('captcha-loading')).toBeNull()

    await act(async () => {
      webView.props.onMessage({
        nativeEvent: {data: JSON.stringify({type: 'error', message: 'Ошибка виджета'})},
      })
    })
    expect(onTokenChange).toHaveBeenLastCalledWith('')
    expect(onError).toHaveBeenLastCalledWith('Ошибка виджета')
  })

  it('блокирует внешнюю навигацию верхнего фрейма, но разрешает iframe и about:blank', async () => {
    const screen = await render(
      <AuthSmartCaptcha
        onError={onError}
        onTokenChange={onTokenChange}
        resetKey={0}
        testID="captcha"
      />,
    )
    const allowNavigation = screen.getByTestId('captcha-webview').props
      .onShouldStartLoadWithRequest

    expect(allowNavigation({url: 'https://evil.example', isTopFrame: true})).toBe(false)
    expect(allowNavigation({url: 'https://captcha-api.example', isTopFrame: false})).toBe(true)
    expect(allowNavigation({url: 'about:blank', isTopFrame: true})).toBe(true)
  })

  it('показывает отдельную ошибку при HTTP-сбое страницы CAPTCHA', async () => {
    const screen = await render(
      <AuthSmartCaptcha
        onError={onError}
        onTokenChange={onTokenChange}
        resetKey={0}
        testID="captcha"
      />,
    )

    await act(async () => {
      screen.getByTestId('captcha-webview').props.onHttpError()
    })

    expect(onTokenChange).toHaveBeenCalledWith('')
    expect(onError).toHaveBeenCalledWith('Сервис CAPTCHA временно недоступен.')
  })
})
