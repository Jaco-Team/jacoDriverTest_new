import React, { useRef } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { useAuthLogic } from '../model/useAuthLogic'
import { AuthSmartCaptcha } from '@/shared/ui/auth/AuthSmartCaptcha'
import { AuthScreenLayout } from '@/shared/ui/auth/AuthScreenLayout'
import { AuthFieldGroup } from '@/shared/ui/auth/AuthKeyboardContext'
import {
  AuthHeading,
  AuthLinkButton,
  AuthMessage,
  AuthPrimaryButton,
  AuthSecondaryButton,
} from '@/shared/ui/auth/AuthSsoKit'
import { AuthTextField } from '@/shared/ui/auth/AuthTextField'
import {useCodePushScreenCommit} from '@/codePush/useCodePushReadiness'
import {useCodePushDebug} from '@/features/codepush-debug/ui/CodePushDebugProvider'

/** Вход в том же виде, что страница входа SSO и ШЭФ. */
export function AuthScreen(): React.JSX.Element {
  const {open: openCodePushDebug} = useCodePushDebug()
  const passwordRef = useRef<React.ElementRef<typeof TextInput>>(null)
  const {
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
    GoToResetPWD,
  } = useAuthLogic()

  useCodePushScreenCommit('Auth')

  const filled = myLogin.trim().length > 0 && myPWD.length > 0

  return (
    <AuthScreenLayout>
      <AuthHeading
        title="Вход в аккаунт"
        subtitle="Введите номер телефона и пароль"
        titleTestID="auth-title"
        onLogoLongPress={openCodePushDebug}
      />

      <AuthFieldGroup>
        <AuthTextField
          autoCapitalize="none"
          autoComplete="tel"
          textContentType="telephoneNumber"
          autoCorrect={false}
          keyboardType="phone-pad"
          label="Номер телефона"
          placeholder="+7 (999) 123-45-67"
          returnKeyType="next"
          submitBehavior="submit"
          testID="auth-login-input"
          value={myLogin}
          onChangeText={handleLoginChange}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <View style={styles.gap}>
          <AuthTextField
            ref={passwordRef}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
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
      </AuthFieldGroup>

      {captchaRequired ? (
        <View style={styles.captcha}>
          <AuthSmartCaptcha
            onError={handleCaptchaError}
            onTokenChange={handleCaptchaTokenChange}
            resetKey={captchaResetKey}
            testID="auth-captcha"
          />
        </View>
      ) : null}

      {loginError ? <AuthMessage testID="auth-error" text={loginError} /> : null}

      <AuthPrimaryButton
        busy={isLoading}
        disabled={!filled}
        label="Войти"
        testID="auth-submit"
        onPress={() => void LogIn(myLogin, myPWD)}
      />

      <AuthSecondaryButton
        accessibilityHint="Открывает защищённый вход через SSO"
        busy={isLoading}
        label="Продолжить через SSO"
        testID="auth-sso"
        onPress={() => void LoginWithSSO()}
      />

      <AuthLinkButton label="Восстановить пароль" testID="auth-reset-password" onPress={GoToResetPWD} />
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  gap: {
    marginTop: 24,
  },
  captcha: {
    marginTop: 16,
  },
})
