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

import { useResetPwdLogic } from '../model/useResetPwdLogic'
import { PasswordRequirements } from './PasswordRequirements'
import { RecoveryStepper } from './RecoveryStepper'

import { AuthSmartCaptcha } from '@/shared/ui/auth/AuthSmartCaptcha'
import { AuthScreenLayout } from '@/shared/ui/auth/AuthScreenLayout'
import { AuthTextField } from '@/shared/ui/auth/AuthTextField'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'

export function ResetPwdScreen(): React.JSX.Element {
  const { colors } = useAppTheme()
  const passwordRef = useRef<React.ElementRef<typeof TextInput>>(null)
  const returnLinkTextWidth = useRef(0)
  const returnLinkUnderlineWidth = useRef(new Animated.Value(0)).current
  const returnLinkUnderlineOpacity = useRef(new Animated.Value(0.55)).current
  const {
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
    canResendCode,
    handleCaptchaTokenChange,
    handleCaptchaError,
    isLoading,
    canRequestCode,
    canConfirmCode,
    requestRecoveryCode,
    confirmRecoveryCode,
    goToAuth,
  } = useResetPwdLogic()

  const canSubmit = recoveryComplete
    ? !isLoading
    : activeStep === 0
      ? canRequestCode
      : canConfirmCode
  const submitLabel = recoveryComplete
    ? 'Войти'
    : retryAfter > 0
      ? `Повторить через ${retryAfter} с`
      : activeStep === 0
        ? 'Получить код'
        : 'Подтвердить'

  function animateReturnLinkUnderline(isPressed: boolean): void {
    const textWidth = returnLinkTextWidth.current

    Animated.parallel([
      Animated.timing(returnLinkUnderlineWidth, {
        toValue: textWidth * (isPressed ? 1 : 0.34),
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(returnLinkUnderlineOpacity, {
        toValue: isPressed ? 1 : 0.55,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start()
  }

  function submitCurrentStep(): void {
    if (recoveryComplete) {
      goToAuth()
      return
    }

    if (activeStep === 0) {
      void requestRecoveryCode()
      return
    }

    void confirmRecoveryCode()
  }

  return (
    <AuthScreenLayout>
      <View style={[styles.logoBadge, { borderColor: colors.border, backgroundColor: colors.surfaceRaised, shadowColor: colors.shadowStrong }]}>
        <Image
          accessibilityLabel="Логотип Жако"
          resizeMode="contain"
          source={require('@/shared/assets/logo.png')}
          style={styles.logo}
          testID="reset-logo"
        />
      </View>

      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>ВОССТАНОВЛЕНИЕ ПАРОЛЯ</Text>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.text }]}
        testID="reset-title"
      >
        {panelTitle}
      </Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>{panelText}</Text>

      {!recoveryComplete && <RecoveryStepper activeStep={activeStep} />}

      {recoveryComplete ? null : activeStep === 0 ? (
        <>
          <View style={styles.fieldGroup}>
            <AuthTextField
              autoCapitalize="none"
              autoComplete="tel"
              autoCorrect={false}
              keyboardType="phone-pad"
              editable={!isLoading}
              label="Номер телефона"
              returnKeyType="next"
              testID="reset-phone-input"
              value={myLogin}
              onChangeText={handleLoginChange}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <AuthTextField
              ref={passwordRef}
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
              keyboardType="default"
              editable={!isLoading}
              label="Новый пароль"
              passwordVisible={showPassword}
              returnKeyType="done"
              secureTextEntry={!showPassword}
              spellCheck={false}
              testID="reset-password-input"
              value={myPWD}
              onChangeText={handlePasswordChange}
              onSubmitEditing={() => {
                if (canRequestCode) {
                  void requestRecoveryCode()
                }
              }}
              onTogglePassword={handleTogglePassword}
            />

            <PasswordRequirements password={myPWD} />
          </View>

        </>
      ) : (
        <View style={styles.fieldGroup}>
          <AuthTextField
            autoFocus
            autoComplete={
              Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'
            }
            inputMode="numeric"
            keyboardType="number-pad"
            editable={!isLoading}
            label="Код из смс"
            maxLength={6}
            returnKeyType="done"
            testID="reset-code-input"
            textContentType="oneTimeCode"
            value={myCode}
            onChangeText={handleCodeChange}
            onSubmitEditing={() => {
              if (canConfirmCode) {
                void confirmRecoveryCode()
              }
            }}
          />
        </View>
      )}

      {!recoveryComplete && captchaRequired && (activeStep === 0 || showResendCaptcha) && (
        <>
          {activeStep === 1 && <Text style={[styles.hintText, { color: colors.textMuted }]} testID="reset-resend-captcha-title">Проверка для повторной отправки</Text>}
          <AuthSmartCaptcha
            onError={handleCaptchaError}
            onTokenChange={handleCaptchaTokenChange}
            resetKey={captchaResetKey}
            testID="reset-captcha"
          />
        </>
      )}

      {!recoveryComplete && activeStep === 1 && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canResendCode }}
          disabled={!canResendCode}
          style={styles.resendButton}
          testID="reset-resend"
          onPress={() => { void requestRecoveryCode() }}
        >
          <Text style={[styles.resendText, { color: canResendCode ? colors.brand : colors.textMuted }]}>
            {sendRetryAfter > 0 ? `Отправить снова через ${sendRetryAfter} с` : 'Отправить код ещё раз'}
          </Text>
        </Pressable>
      )}

      {errorText ? (
        <View style={[styles.message, styles.errorMessage, { borderColor: colors.brandSoftStrong, backgroundColor: colors.dangerSurface }]} testID="reset-error">
          <Text accessibilityLiveRegion="polite" style={[styles.errorText, { color: colors.dangerText }]}>
            {errorText}
          </Text>
        </View>
      ) : (
        <View style={[styles.message, styles.hintMessage, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} testID="reset-hint">
          <Text style={[styles.hintText, { color: colors.textMuted }]}>{helperText}</Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        accessibilityState={{
          busy: isLoading,
          disabled: !canSubmit,
        }}
        disabled={!canSubmit}
        style={[
          styles.primaryButton,
          !canSubmit && styles.primaryButtonDisabled,
        ]}
        testID="reset-submit"
        onPress={submitCurrentStep}
      >
        <View
          pointerEvents="none"
          style={[
            styles.primaryButtonSurface,
            { backgroundColor: colors.brand },
            !canSubmit && styles.primaryButtonSurfaceDisabled,
          ]}
        >
          <Text
            style={[
              styles.primaryButtonText,
              !canSubmit && styles.primaryButtonTextDisabled,
            ]}
          >
            {isLoading ? 'Подождите...' : submitLabel}
          </Text>
        </View>
      </Pressable>

      {!recoveryComplete && <View style={styles.linkRow}>
        <Text style={[styles.linkCaption, { color: colors.textMuted }]}>Вспомнили пароль?</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Вернуться к авторизации"
          hitSlop={8}
          style={styles.returnLink}
          testID="reset-back-to-auth"
          onPressIn={() => animateReturnLinkUnderline(true)}
          onPressOut={() => animateReturnLinkUnderline(false)}
          onPress={goToAuth}
        >
          <Text
            style={[styles.returnLinkText, { color: colors.brand }]}
            onLayout={(event) => {
              const textWidth = event.nativeEvent.layout.width
              returnLinkTextWidth.current = textWidth
              returnLinkUnderlineWidth.setValue(textWidth * 0.34)
            }}
          >
            Вернуться к авторизации
          </Text>
          <Animated.View
            style={[
              styles.returnLinkUnderline,
              {
                backgroundColor: colors.brand,
                width: returnLinkUnderlineWidth,
                opacity: returnLinkUnderlineOpacity,
              },
            ]}
          />
        </Pressable>
      </View>}
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
    backgroundColor:
      Platform.OS === 'android' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.96)',
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
  primaryButtonDisabled: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  primaryButtonSurface: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#CC0033',
  },
  primaryButtonSurfaceDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.16,
  },
  primaryButtonTextDisabled: {
    color: 'rgba(0, 0, 0, 0.38)',
  },
  resendButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 8,
  },
  resendText: {
    fontFamily: 'Roboto-Medium',
    fontSize: 15,
    lineHeight: 22,
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
  returnLink: {
    alignItems: 'flex-start',
  },
  returnLinkText: {
    color: '#CC0033',
    fontFamily: 'Roboto-Bold',
    fontSize: 16,
    lineHeight: 22,
  },
  returnLinkUnderline: {
    height: 2,
    marginTop: 2,
    backgroundColor: '#CC0033',
  },
})
