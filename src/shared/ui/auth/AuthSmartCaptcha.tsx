import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  WebView,
  type WebViewMessageEvent,
} from 'react-native-webview'

import { laravelApiConfig } from '@/shared/api/laravel/config'

type CaptchaMessage = {
  message?: string
  token?: string
  type?: 'error' | 'expired' | 'ready' | 'success'
}

interface AuthSmartCaptchaProps {
  onError: (message: string) => void
  onTokenChange: (token: string) => void
  resetKey: number
  testID: string
}

interface CaptchaNavigationRequest {
  isTopFrame: boolean
  url: string
}

function parseCaptchaMessage(value: string): CaptchaMessage | null {
  try {
    const message = JSON.parse(value) as CaptchaMessage
    return message && typeof message === 'object' ? message : null
  } catch {
    return null
  }
}

export function AuthSmartCaptcha({
  onError,
  onTokenChange,
  resetKey,
  testID,
}: AuthSmartCaptchaProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setIsLoading(true)
    setLoadError('')
  }, [resetKey])

  const reportError = useCallback((message: string) => {
    onTokenChange('')
    setLoadError(message)
    onError(message)
  }, [onError, onTokenChange])

  const retry = useCallback(() => {
    setIsLoading(true)
    setLoadError('')
    onTokenChange('')
    onError('')
    setReloadKey((currentValue) => currentValue + 1)
  }, [onError, onTokenChange])

  const allowNavigation = useCallback((request: CaptchaNavigationRequest) => {
    if (request.isTopFrame === false) {
      return true
    }

    return request.url === laravelApiConfig.captchaPageUrl || request.url === 'about:blank'
  }, [])

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const message = parseCaptchaMessage(event.nativeEvent.data)

    if (message?.type === 'success' && typeof message.token === 'string' && message.token.trim()) {
      setIsLoading(false)
      setLoadError('')
      onTokenChange(message.token)
      return
    }

    if (message?.type === 'ready') {
      setIsLoading(false)
      return
    }

    if (message?.type === 'expired') {
      reportError('Срок действия CAPTCHA истёк. Пройдите проверку ещё раз.')
      return
    }

    if (message?.type === 'error') {
      reportError(message.message || 'Не удалось загрузить CAPTCHA.')
    }
  }, [onTokenChange, reportError])

  return (
    <View style={styles.container} testID={testID}>
      <WebView
        key={`${resetKey}-${reloadKey}`}
        cacheEnabled={false}
        domStorageEnabled
        javaScriptEnabled
        mixedContentMode="never"
        originWhitelist={[
          'https://*',
          'http://localhost:*',
          'http://127.0.0.1:*',
        ]}
        source={{ uri: laravelApiConfig.captchaPageUrl }}
        style={styles.webView}
        testID={`${testID}-webview`}
        thirdPartyCookiesEnabled
        onError={() => reportError('Не удалось подключиться к CAPTCHA.')}
        onHttpError={() => reportError('Сервис CAPTCHA временно недоступен.')}
        onLoadEnd={() => setIsLoading(false)}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={allowNavigation}
      />

      {isLoading ? (
        <View pointerEvents="none" style={styles.statusOverlay} testID={`${testID}-loading`}>
          <ActivityIndicator color="#42627d" size="small" />
          <Text style={styles.statusText}>Загружаем проверку…</Text>
        </View>
      ) : null}

      {loadError ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.retryButton}
            testID={`${testID}-retry`}
            onPress={retry}
          >
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    height: 132,
    marginTop: 12,
    overflow: 'hidden',
  },
  webView: {
    height: 132,
    backgroundColor: '#ffffff',
  },
  statusOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
  },
  statusText: {
    color: '#6f7f8d',
    fontFamily: 'Roboto-Regular',
    fontSize: 14,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#fff6f7',
  },
  errorText: {
    color: '#a6002a',
    fontFamily: 'Roboto-Medium',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#42627d',
  },
  retryButtonText: {
    color: '#ffffff',
    fontFamily: 'Roboto-Medium',
    fontSize: 14,
  },
})
