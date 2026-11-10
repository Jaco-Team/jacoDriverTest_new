import React, { forwardRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'

import { useAuthPalette } from './authPalette'

interface AuthTextFieldProps extends TextInputProps {
  label: string
  testID: string
  invalid?: boolean
  passwordVisible?: boolean
  onTogglePassword?: () => void
  /** Что показываем и скрываем, в винительном падеже: «пароль», «новый пароль». */
  passwordSubject?: string
}

/** Поле с подписью над ним, как на странице входа SSO. */
export const AuthTextField = forwardRef<
  React.ElementRef<typeof TextInput>,
  AuthTextFieldProps
>(function AuthTextField(
  {
    label,
    testID,
    value,
    invalid = false,
    passwordVisible = false,
    onTogglePassword,
    passwordSubject = 'пароль',
    editable = true,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref
) {
  const palette = useAuthPalette()
  const [isFocused, setIsFocused] = useState(false)
  const borderColor = invalid ? palette.error : isFocused ? palette.crimson : palette.border

  return (
    <View>
      <Text style={[styles.label, { color: palette.label }]}>{label}</Text>
      <View
        style={[
          styles.field,
          { borderColor, backgroundColor: palette.field },
          isFocused && { shadowColor: palette.crimson, ...styles.fieldFocused },
          !editable && styles.fieldDisabled,
        ]}
        testID={`${testID}-container`}
      >
        <TextInput
          ref={ref}
          {...inputProps}
          value={value}
          editable={editable}
          style={[styles.input, onTogglePassword ? styles.inputWithToggle : null, { color: palette.ink }]}
          placeholderTextColor={palette.muted}
          selectionColor={palette.crimson}
          accessibilityLabel={label}
          testID={testID}
          onFocus={(event) => {
            setIsFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setIsFocused(false)
            onBlur?.(event)
          }}
        />
        {onTogglePassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${passwordVisible ? 'Скрыть' : 'Показать'} ${passwordSubject}`}
            accessibilityState={{ selected: passwordVisible }}
            hitSlop={10}
            style={styles.passwordToggle}
            testID={testID === 'auth-password-input' ? 'auth-password-toggle' : `${testID}-toggle`}
            onPress={onTogglePassword}
          >
            {passwordVisible ? (
              <EyeOff color={palette.muted} size={20} />
            ) : (
              <Eye color={palette.muted} size={20} />
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
    fontFamily: 'Roboto-Medium',
    fontSize: 16,
    lineHeight: 24,
  },
  field: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  // Кольцо фокуса со страницы SSO: мягкое свечение вокруг поля.
  fieldFocused: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  input: {
    minWidth: 0,
    height: 46,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    fontFamily: 'Roboto-Regular',
    fontSize: 15,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  inputWithToggle: {
    paddingRight: 4,
  },
  passwordToggle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderRadius: 18,
  },
})
