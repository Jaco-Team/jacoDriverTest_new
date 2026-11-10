import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { MessageSquareMore, Phone, Send } from 'lucide-react-native'

import { useResetPwdLogic, type RecoveryStep } from '../model/useResetPwdLogic'
import type { LaravelRecoveryChannel } from '@/shared/api/laravel/auth'
import { formatCountdown } from '@/shared/lib/phoneInput'
import { useAuthPalette } from '@/shared/ui/auth/authPalette'
import { AuthSmartCaptcha } from '@/shared/ui/auth/AuthSmartCaptcha'
import { AuthScreenLayout } from '@/shared/ui/auth/AuthScreenLayout'
import {
  AuthChannelSwitch,
  AuthCodeCells,
  AuthHeading,
  AuthLinkButton,
  AuthMessage,
  AuthPasswordRules,
  AuthPrimaryButton,
  type AuthChannelOption,
} from '@/shared/ui/auth/AuthSsoKit'
import { AuthTextField } from '@/shared/ui/auth/AuthTextField'

const CHANNEL_OPTIONS: Record<LaravelRecoveryChannel, AuthChannelOption<LaravelRecoveryChannel>> = {
  sms: { value: 'sms', label: 'SMS', helper: 'Придёт SMS с 6-значным кодом', icon: MessageSquareMore },
  telegram: {
    value: 'telegram',
    label: 'Telegram',
    helper: 'Код придёт в чат с ботом, Telegram должен быть привязан к номеру',
    icon: Send,
  },
  voice: { value: 'voice', label: 'Звонок', helper: 'Робот позвонит и продиктует код', icon: Phone },
}

const TITLES: Record<RecoveryStep, string> = {
  request: 'Восстановление пароля',
  code: 'Введите код',
  password: 'Придумайте новый пароль',
  success: 'Пароль изменён',
}

const SUBMIT_LABELS: Record<RecoveryStep, string> = {
  request: 'Отправить код',
  code: 'Подтвердить',
  password: 'Сохранить пароль',
  success: 'Войти',
}

/** Восстановление пароля в том же виде и с теми же шагами, что страница входа SSO и ШЭФ. */
export function ResetPwdScreen(): React.JSX.Element {
  const palette = useAuthPalette()
  const recovery = useResetPwdLogic()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [repeatVisible, setRepeatVisible] = useState(false)
  const { step, loading } = recovery

  const subtitle =
    step === 'request' ? (
      'Отправим код подтверждения на ваш номер'
    ) : step === 'code' ? (
      <>
        Код подтверждения для номера{'\n'}
        <Text style={[styles.phone, { color: palette.label }]} testID="reset-masked-phone">
          {recovery.maskedPhone}
        </Text>
        {'  '}
        <Text
          accessibilityRole="link"
          style={[styles.inlineLink, { color: palette.accent }]}
          testID="reset-edit-phone"
          onPress={recovery.editPhone}
        >
          Изменить
        </Text>
      </>
    ) : step === 'password' ? (
      'Используйте строчные и заглавные латинские буквы и цифры'
    ) : (
      'Теперь вы можете войти с новым паролем'
    )

  const countdown =
    step === 'request' && recovery.resendAfter > 0
      ? `Отправить повторно через ${formatCountdown(recovery.resendAfter)}`
      : step === 'password' && recovery.retryAfter > 0
        ? `Повторите через ${formatCountdown(recovery.retryAfter)}`
        : ''

  return (
    <AuthScreenLayout>
      <AuthHeading
        mark={step === 'request' ? 'logo' : step === 'success' ? 'success' : 'none'}
        subtitle={subtitle}
        title={TITLES[step]}
        titleTestID="reset-title"
        wideGap={step === 'success'}
        onBack={step === 'code' || step === 'password' ? recovery.back : undefined}
      />

      {step === 'request' ? (
        <>
          <AuthTextField
            autoCapitalize="none"
            autoComplete="tel"
            autoCorrect={false}
            editable={!loading}
            invalid={Boolean(recovery.phoneError)}
            keyboardType="phone-pad"
            label="Номер телефона"
            placeholder="+7 (999) 123-45-67"
            returnKeyType="done"
            testID="reset-login-input"
            value={recovery.phone}
            onChangeText={recovery.setPhone}
          />
          {recovery.phoneError ? (
            <Text
              accessibilityRole="alert"
              style={[styles.fieldError, { color: palette.error }]}
              testID="reset-phone-error"
            >
              {recovery.phoneError}
            </Text>
          ) : null}
          {recovery.channels.length > 1 ? (
            <AuthChannelSwitch
              disabled={loading}
              options={recovery.channels.map((channel) => CHANNEL_OPTIONS[channel])}
              value={recovery.channel}
              onChange={recovery.setChannel}
            />
          ) : null}
        </>
      ) : null}

      {step === 'code' ? (
        <>
          <AuthCodeCells
            disabled={loading}
            error={Boolean(recovery.error?.code)}
            testID="reset-code-input"
            value={recovery.code}
            onChange={recovery.setCode}
          />
          <View style={styles.resend}>
            {recovery.resendAfter > 0 ? (
              <Text style={[styles.resendWait, { color: palette.muted }]} testID="reset-resend-wait">
                Отправить повторно через {formatCountdown(recovery.resendAfter)}
              </Text>
            ) : (
              <AuthLinkButton
                disabled={loading}
                label="Отправить снова"
                testID="reset-resend"
                variant="accent"
                onPress={recovery.resend}
              />
            )}
            {recovery.channels.length > 1 ? (
              <AuthLinkButton
                disabled={loading}
                label="Выбрать другой способ"
                testID="reset-change-channel"
                variant="small"
                onPress={recovery.changeChannel}
              />
            ) : null}
          </View>
        </>
      ) : null}

      {step === 'password' ? (
        <>
          <AuthTextField
            autoCapitalize="none"
            autoComplete="new-password"
            autoCorrect={false}
            editable={!loading}
            label="Новый пароль"
            passwordSubject="новый пароль"
            passwordVisible={passwordVisible}
            secureTextEntry={!passwordVisible}
            spellCheck={false}
            testID="reset-password-input"
            value={recovery.password}
            onChangeText={recovery.setPassword}
            onTogglePassword={() => setPasswordVisible((visible) => !visible)}
          />
          <View style={styles.gap}>
            <AuthTextField
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
              editable={!loading}
              label="Повторите пароль"
              passwordSubject="подтверждение пароля"
              passwordVisible={repeatVisible}
              secureTextEntry={!repeatVisible}
              spellCheck={false}
              testID="reset-repeat-password-input"
              value={recovery.repeatPassword}
              onChangeText={recovery.setRepeatPassword}
              onSubmitEditing={recovery.submit}
              onTogglePassword={() => setRepeatVisible((visible) => !visible)}
            />
          </View>
          <AuthPasswordRules
            rules={[
              { key: 'length', text: 'Не менее 8 символов', met: recovery.passwordRules.length },
              { key: 'characters', text: 'Буквы и цифры', met: recovery.passwordRules.characters },
              { key: 'match', text: 'Пароли совпадают', met: recovery.passwordRules.match },
            ]}
          />
        </>
      ) : null}

      {recovery.captchaVisible ? (
        <View style={styles.gap}>
          <AuthSmartCaptcha
            resetKey={recovery.captchaResetKey}
            testID="reset-captcha"
            onError={recovery.handleCaptchaError}
            onTokenChange={recovery.handleCaptchaTokenChange}
          />
        </View>
      ) : null}

      {step === 'code' && recovery.recoveryMessage && !recovery.error ? (
        <AuthMessage testID="reset-message" text={recovery.recoveryMessage} tone="note" />
      ) : null}

      {recovery.error ? (
        <AuthMessage
          testID="reset-error"
          text={recovery.error.text}
          title={recovery.error.code ? 'Неверный код' : undefined}
        />
      ) : null}

      {countdown ? <AuthMessage testID="reset-countdown" text={countdown} tone="note" /> : null}

      <AuthPrimaryButton
        busy={loading}
        disabled={!recovery.canSubmit}
        label={SUBMIT_LABELS[step]}
        style={step === 'success' ? styles.flush : undefined}
        testID="reset-submit"
        onPress={recovery.submit}
      />

      {step === 'request' ? (
        <AuthLinkButton label="← Вернуться ко входу" testID="reset-return-to-auth" onPress={recovery.goToLogin} />
      ) : null}
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  gap: {
    marginTop: 16,
  },
  phone: {
    fontFamily: 'Roboto-Regular',
  },
  inlineLink: {
    fontFamily: 'Roboto-Medium',
    fontSize: 14,
  },
  fieldError: {
    marginTop: 8,
    fontFamily: 'Roboto-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  resend: {
    alignItems: 'center',
    marginTop: 24,
  },
  resendWait: {
    fontFamily: 'Roboto-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  // На шаге «готово» отступ над кнопкой уже задан подзаголовком.
  flush: {
    marginTop: 0,
  },
})
