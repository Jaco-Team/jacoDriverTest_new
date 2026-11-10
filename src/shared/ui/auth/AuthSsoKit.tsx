import React, { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { ArrowLeft, Check, CircleCheck, type LucideIcon } from 'lucide-react-native'

import { useAuthPalette } from './authPalette'

// Части экранов входа и восстановления пароля. Размеры и цвета взяты со страницы
// входа SSO (laravel-api-driver, resources/views/idp/partials/styles.blade.php):
// при изменении оформления правьте оба места.

interface AuthHeadingProps {
  title: string
  subtitle: React.ReactNode
  /** Что стоит над заголовком: логотип, значок успеха или ничего. */
  mark?: 'logo' | 'success' | 'none'
  onBack?: () => void
  onLogoLongPress?: () => void
  titleTestID?: string
  /** Увеличенный отступ под подзаголовком на шаге «готово». */
  wideGap?: boolean
}

export function AuthHeading({
  title,
  subtitle,
  mark = 'logo',
  onBack,
  onLogoLongPress,
  titleTestID,
  wideGap = false,
}: AuthHeadingProps): React.JSX.Element {
  const palette = useAuthPalette()

  return (
    <View>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          hitSlop={8}
          style={styles.back}
          testID="auth-back"
          onPress={onBack}
        >
          <ArrowLeft color={palette.muted} size={20} />
        </Pressable>
      ) : null}
      {mark === 'logo' ? (
        <Pressable
          accessible={false}
          delayLongPress={3000}
          style={styles.logoBox}
          testID="auth-diagnostics-trigger"
          onLongPress={onLogoLongPress}
        >
          <Image
            accessibilityLabel="Логотип Жако"
            resizeMode="contain"
            source={require('@/shared/assets/logo.png')}
            style={styles.logo}
            testID="auth-logo"
          />
        </Pressable>
      ) : null}
      {mark === 'success' ? (
        <View style={styles.successIcon} testID="auth-success-icon">
          <CircleCheck color={palette.success} size={48} />
        </View>
      ) : null}
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: palette.ink }]}
        testID={titleTestID}
      >
        {title}
      </Text>
      <Text style={[styles.subtitle, wideGap && styles.subtitleWide, { color: palette.muted }]}>
        {subtitle}
      </Text>
    </View>
  )
}

interface AuthButtonProps {
  label: string
  onPress: () => void
  testID: string
  disabled?: boolean
  busy?: boolean
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
}

export function AuthPrimaryButton({
  label,
  onPress,
  testID,
  disabled = false,
  busy = false,
  style,
}: AuthButtonProps): React.JSX.Element {
  const palette = useAuthPalette()
  const inactive = disabled || busy

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: inactive }}
      disabled={inactive}
      style={[styles.primary, { backgroundColor: palette.crimson }, inactive && styles.dimmed, style]}
      testID={testID}
      onPress={onPress}
    >
      {busy ? <ActivityIndicator color="#FFFFFF" size="small" style={styles.spinner} /> : null}
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  )
}

/** Второй способ входа: на странице SSO такой кнопки нет, оформление в её стиле. */
export function AuthSecondaryButton({
  label,
  onPress,
  testID,
  disabled = false,
  busy = false,
  accessibilityHint,
}: AuthButtonProps): React.JSX.Element {
  const palette = useAuthPalette()
  const inactive = disabled || busy

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy, disabled: inactive }}
      disabled={inactive}
      style={[
        styles.secondary,
        { borderColor: palette.border, backgroundColor: palette.card },
        inactive && styles.dimmed,
      ]}
      testID={testID}
      onPress={onPress}
    >
      <Text style={[styles.secondaryText, { color: palette.ink }]}>{label}</Text>
    </Pressable>
  )
}

interface AuthLinkButtonProps {
  label: string
  onPress: () => void
  testID: string
  disabled?: boolean
  /** link — серая ссылка под кнопкой; accent — красная «Отправить снова»; small — мелкая серая. */
  variant?: 'link' | 'accent' | 'small'
}

export function AuthLinkButton({
  label,
  onPress,
  testID,
  disabled = false,
  variant = 'link',
}: AuthLinkButtonProps): React.JSX.Element {
  const palette = useAuthPalette()

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      style={[
        variant === 'link' ? styles.link : variant === 'accent' ? styles.linkAccent : styles.linkSmall,
        disabled && styles.dimmed,
      ]}
      testID={testID}
      onPress={onPress}
    >
      <Text
        style={[
          variant === 'accent' ? styles.linkAccentText : styles.linkText,
          { color: variant === 'accent' ? palette.accent : palette.muted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

interface AuthMessageProps {
  text: string
  testID: string
  /** error — красный текст отказа; note — серое пояснение. */
  tone?: 'error' | 'note'
  title?: string
}

export function AuthMessage({ text, testID, tone = 'error', title }: AuthMessageProps): React.JSX.Element {
  const palette = useAuthPalette()
  const color = tone === 'error' ? palette.error : palette.muted

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={styles.message}
      testID={testID}
    >
      {title ? <Text style={[styles.messageText, styles.messageTitle, { color }]}>{title}</Text> : null}
      <Text style={[styles.messageText, { color }]}>{text}</Text>
    </View>
  )
}

export interface AuthChannelOption<T extends string> {
  value: T
  label: string
  helper: string
  icon: LucideIcon
}

interface AuthChannelSwitchProps<T extends string> {
  options: ReadonlyArray<AuthChannelOption<T>>
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

/** Переключатель способа получения кода с подписью под ним. */
export function AuthChannelSwitch<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: AuthChannelSwitchProps<T>): React.JSX.Element {
  const palette = useAuthPalette()
  const active = options.find(option => option.value === value) ?? options[0]

  return (
    <View style={styles.channelBlock}>
      <Text style={[styles.channelLabel, { color: palette.ink }]}>Способ получения кода</Text>
      <View
        accessibilityRole="tablist"
        style={[styles.segment, { backgroundColor: palette.segment }]}
        testID="auth-channel-switch"
      >
        {options.map(option => {
          const selected = option.value === active.value
          const color = selected ? palette.accent : palette.segmentText
          const Icon = option.icon

          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              style={[
                styles.segmentTab,
                selected && [styles.segmentTabSelected, { backgroundColor: palette.segmentThumb }],
              ]}
              testID={`auth-channel-${option.value}`}
              onPress={() => onChange(option.value)}
            >
              <Icon color={color} size={18} />
              <Text numberOfLines={1} style={[styles.segmentText, { color }]}>
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {/* Высота на две строки, чтобы блок не прыгал при смене способа. */}
      <Text style={[styles.helper, { color: palette.muted }]} testID="auth-channel-helper">
        {active.helper}
      </Text>
    </View>
  )
}

export const AUTH_CODE_LENGTH = 6

interface AuthCodeCellsProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: boolean
  testID: string
}

/**
 * Шесть ячеек кода подтверждения. Ввод принимает одно скрытое поле: так работает
 * подстановка кода из SMS и вставка из буфера.
 */
export function AuthCodeCells({
  value,
  onChange,
  disabled = false,
  error = false,
  testID,
}: AuthCodeCellsProps): React.JSX.Element {
  const palette = useAuthPalette()
  const input = useRef<React.ElementRef<typeof TextInput>>(null)
  const [focused, setFocused] = useState(false)
  const activeIndex = Math.min(value.length, AUTH_CODE_LENGTH - 1)

  return (
    <Pressable
      accessible={false}
      style={[styles.code, disabled && styles.codeDisabled]}
      onPress={() => input.current?.focus()}
    >
      {Array.from({ length: AUTH_CODE_LENGTH }, (_, index) => (
        <View
          key={index}
          style={[
            styles.codeCell,
            {
              backgroundColor: palette.field,
              borderColor: error
                ? palette.error
                : focused && index === activeIndex
                  ? palette.crimson
                  : palette.border,
            },
          ]}
          testID={`${testID}-cell-${index}`}
        >
          <Text style={[styles.codeDigit, { color: palette.ink }]}>{value[index] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        ref={input}
        accessibilityLabel="Код подтверждения, 6 цифр"
        autoComplete="sms-otp"
        autoFocus
        caretHidden
        editable={!disabled}
        keyboardType="number-pad"
        maxLength={AUTH_CODE_LENGTH}
        style={styles.codeInput}
        testID={testID}
        textContentType="oneTimeCode"
        value={value}
        onBlur={() => setFocused(false)}
        onChangeText={text => onChange(text.replace(/\D/g, '').slice(0, AUTH_CODE_LENGTH))}
        onFocus={() => setFocused(true)}
      />
    </Pressable>
  )
}

export interface AuthPasswordRule {
  key: string
  text: string
  met: boolean
}

export function AuthPasswordRules({ rules }: { rules: ReadonlyArray<AuthPasswordRule> }): React.JSX.Element {
  const palette = useAuthPalette()

  return (
    <View accessibilityLabel="Требования к паролю" style={styles.rules}>
      {rules.map(rule => {
        const color = rule.met ? palette.success : palette.muted

        return (
          <View
            key={rule.key}
            accessible
            accessibilityLabel={`${rule.text} — ${rule.met ? 'выполнено' : 'не выполнено'}`}
            style={styles.rule}
            testID={`auth-password-rule-${rule.key}`}
          >
            <Check color={color} size={16} />
            <Text style={[styles.ruleText, { color }]}>{rule.text}</Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  back: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginLeft: -6,
    borderRadius: 16,
  },
  logoBox: {
    width: 32,
    height: 32,
    marginBottom: 24,
  },
  logo: {
    width: 32,
    height: 32,
  },
  successIcon: {
    marginBottom: 28,
  },
  title: {
    fontFamily: 'Roboto-Bold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginBottom: 24,
    fontFamily: 'Roboto-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  subtitleWide: {
    marginBottom: 32,
  },
  primary: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  primaryText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontSize: 15,
    lineHeight: 26,
  },
  spinner: {
    marginRight: 8,
  },
  dimmed: {
    opacity: 0.4,
  },
  secondary: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: 12,
  },
  secondaryText: {
    fontFamily: 'Roboto-Bold',
    fontSize: 15,
    lineHeight: 26,
  },
  link: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkText: {
    fontFamily: 'Roboto-Medium',
    fontSize: 13,
    lineHeight: 22,
  },
  linkAccent: {
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkAccentText: {
    fontFamily: 'Roboto-Medium',
    fontSize: 14,
    lineHeight: 24,
  },
  linkSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    padding: 4,
  },
  message: {
    marginTop: 16,
  },
  messageText: {
    fontFamily: 'Roboto-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  messageTitle: {
    fontFamily: 'Roboto-Bold',
  },
  channelBlock: {
    marginTop: 24,
  },
  channelLabel: {
    marginBottom: 8,
    fontFamily: 'Roboto-Medium',
    fontSize: 16,
    lineHeight: 24,
  },
  segment: {
    minHeight: 64,
    flexDirection: 'row',
    padding: 8,
    borderRadius: 12,
  },
  segmentTab: {
    minWidth: 0,
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  segmentTabSelected: {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  segmentText: {
    flexShrink: 1,
    fontFamily: 'Roboto-Medium',
    fontSize: 16,
    lineHeight: 21,
  },
  helper: {
    minHeight: 48,
    marginTop: 8,
    fontFamily: 'Roboto-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  code: {
    flexDirection: 'row',
    gap: 8,
  },
  codeDisabled: {
    opacity: 0.6,
  },
  codeCell: {
    minWidth: 0,
    height: 56,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  codeDigit: {
    fontFamily: 'Roboto-Bold',
    fontSize: 24,
    lineHeight: 30,
  },
  // Поле ввода лежит поверх ячеек и не видно: цифры рисуют сами ячейки.
  codeInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.011,
    color: 'transparent',
  },
  rules: {
    gap: 8,
    marginTop: 16,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleText: {
    fontFamily: 'Roboto-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
})
