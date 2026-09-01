import React, { useRef } from 'react'
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { useAuthLogic } from '../model/useAuthLogic'

import { AuthCaptchaPlaceholder } from '@/shared/ui/auth/AuthCaptchaPlaceholder'
import { AuthScreenLayout } from '@/shared/ui/auth/AuthScreenLayout'
import { AuthTextField } from '@/shared/ui/auth/AuthTextField'

export function AuthScreen(): React.JSX.Element {
  const passwordRef = useRef<React.ElementRef<typeof TextInput>>(null)
  const resetLinkTextWidth = useRef(0)
  const resetLinkUnderlineWidth = useRef(new Animated.Value(0)).current
  const resetLinkUnderlineOpacity = useRef(new Animated.Value(0.55)).current
  const {
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
    GoToResetPWD,
  } = useAuthLogic()

  function animateResetLinkUnderline(isPressed: boolean): void {
    const textWidth = resetLinkTextWidth.current

    Animated.parallel([
      Animated.timing(resetLinkUnderlineWidth, {
        toValue: textWidth * (isPressed ? 1 : 0.34),
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(resetLinkUnderlineOpacity, {
        toValue: isPressed ? 1 : 0.55,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start()
  }

  return (
    <AuthScreenLayout>
      <View style={styles.logoBadge}>
        <Image
          accessibilityLabel="Логотип Жако"
          resizeMode="contain"
          source={require('@/shared/assets/logo.png')}
          style={styles.logo}
          testID="auth-logo"
        />
      </View>

      <Text style={styles.eyebrow}>АВТОРИЗАЦИЯ</Text>
      <Text accessibilityRole="header" style={styles.title} testID="auth-title">
        Вход в аккаунт
      </Text>
      <Text style={styles.description}>
        Введите номер телефона и пароль, чтобы продолжить работу в приложении.
      </Text>

      <View style={styles.fieldGroup}>
        <AuthTextField
          autoCapitalize="none"
          autoComplete="tel"
          autoCorrect={false}
          keyboardType="phone-pad"
          label="Номер телефона"
          returnKeyType="next"
          testID="auth-login-input"
          value={myLogin}
          onChangeText={handleLoginChange}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <AuthTextField
          ref={passwordRef}
          autoCapitalize="none"
          autoComplete="current-password"
          autoCorrect={false}
          keyboardType="default"
          label="Пароль"
          passwordVisible={showPassword}
          returnKeyType="done"
          secureTextEntry={!showPassword}
          spellCheck={false}
          testID="auth-password-input"
          value={myPWD}
          onChangeText={handlePasswordChange}
          onSubmitEditing={() => void LogIn(myLogin, myPWD)}
          onTogglePassword={handleTogglePassword}
        />
      </View>

      {captchaRequired ? (
        <AuthCaptchaPlaceholder testID="auth-captcha-placeholder" />
      ) : null}

      {loginError ? (
        <View style={[styles.message, styles.errorMessage]} testID="auth-error">
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {loginError}
          </Text>
        </View>
      ) : (
        <View style={[styles.message, styles.hintMessage]} testID="auth-hint">
          <Text style={styles.hintText}>
            Используйте номер телефона, указанный в вашем рабочем аккаунте.
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Войти"
        accessibilityState={{ busy: isLoading, disabled: isLoading }}
        disabled={isLoading}
        style={[
          styles.primaryButton,
          isLoading && styles.primaryButtonDisabled,
        ]}
        testID="auth-submit"
        onPress={() => void LogIn(myLogin, myPWD)}
      >
        <View pointerEvents="none" style={styles.primaryButtonSurface}>
          <Text style={styles.primaryButtonText}>Войти</Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Продолжить через SSO"
        accessibilityHint="Визуальная заглушка, вход через SSO пока недоступен"
        accessibilityState={{ disabled: true }}
        disabled
        style={styles.secondaryButton}
        testID="auth-sso-placeholder"
      >
        <Text style={styles.secondaryButtonText}>Продолжить через SSO</Text>
      </Pressable>

      <View style={styles.linkRow}>
        <Text style={styles.linkCaption}>Не получается войти?</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Восстановить пароль"
          hitSlop={8}
          style={styles.resetLink}
          testID="auth-reset-password"
          onPressIn={() => animateResetLinkUnderline(true)}
          onPressOut={() => animateResetLinkUnderline(false)}
          onPress={GoToResetPWD}
        >
          <Text
            style={styles.resetLinkText}
            onLayout={(event) => {
              const textWidth = event.nativeEvent.layout.width
              resetLinkTextWidth.current = textWidth
              resetLinkUnderlineWidth.setValue(textWidth * 0.34)
            }}
          >
            Восстановить пароль
          </Text>
          <Animated.View
            style={[
              styles.resetLinkUnderline,
              {
                width: resetLinkUnderlineWidth,
                opacity: resetLinkUnderlineOpacity,
              },
            ]}
          />
        </Pressable>
      </View>
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  logoBadge: {
    width: 84,
    height: 84,
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderWidth: Platform.OS === 'android' ? 0 : 1,
    borderColor: 'rgba(37, 18, 22, 0.08)',
    borderRadius: Platform.OS === 'android' ? 42 : 28,
    backgroundColor: Platform.OS === 'android' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#181114',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 19,
    elevation: 4,
  },
  logo: {
    width: Platform.OS === 'android' ? 84 : 92,
    height: Platform.OS === 'android' ? 84 : 92,
  },
  eyebrow: {
    color: 'rgba(54, 69, 81, 0.70)',
    fontFamily: 'Roboto-Bold',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 12,
    color: '#1F1015',
    fontFamily: 'Roboto-Black',
    fontSize: 32,
    lineHeight: 34,
  },
  description: {
    marginTop: 10,
    marginBottom: 18,
    color: 'rgba(53, 38, 43, 0.72)',
    fontFamily: 'Roboto-Regular',
    fontSize: 15,
    lineHeight: 25,
  },
  fieldGroup: {
    gap: 14,
  },
  message: {
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 18,
  },
  hintMessage: {
    borderColor: 'rgba(24, 17, 20, 0.05)',
    backgroundColor: 'rgba(24, 17, 20, 0.04)',
  },
  hintText: {
    color: 'rgba(53, 38, 43, 0.66)',
    fontFamily: 'Roboto-Medium',
    fontSize: 15,
    lineHeight: 24,
  },
  errorMessage: {
    borderColor: 'rgba(156, 74, 61, 0.14)',
    backgroundColor: 'rgba(156, 74, 61, 0.08)',
  },
  errorText: {
    color: '#9C4A3D',
    fontFamily: 'Roboto-Bold',
    fontSize: 15,
    lineHeight: 24,
  },
  primaryButton: {
    height: 52,
    marginTop: 18,
    borderRadius: 18,
    shadowColor: '#A6002A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 17,
    elevation: 6,
  },
  primaryButtonSurface: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#CC0033',
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.16,
  },
  secondaryButton: {
    minHeight: 52,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(31, 61, 86, 0.28)',
    borderRadius: 18,
    backgroundColor: 'rgba(245, 249, 253, 0.90)',
  },
  secondaryButtonText: {
    color: '#1F3D56',
    fontFamily: 'Roboto-Bold',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.16,
  },
  linkRow: {
    gap: 8,
    marginTop: 18,
    alignItems: 'flex-start',
  },
  linkCaption: {
    color: 'rgba(53, 38, 43, 0.58)',
    fontFamily: 'Roboto-Medium',
    fontSize: 15,
    lineHeight: 18,
  },
  resetLink: {
    alignItems: 'flex-start',
  },
  resetLinkText: {
    color: '#CC0033',
    fontFamily: 'Roboto-Bold',
    fontSize: 16,
    lineHeight: 22,
  },
  resetLinkUnderline: {
    height: 2,
    marginTop: 2,
    backgroundColor: '#CC0033',
  },
})
