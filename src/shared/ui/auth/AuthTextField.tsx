import React, { forwardRef, useCallback, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'

import { useAuthPalette } from './authPalette'
import { useAuthKeyboard } from './AuthKeyboardContext'

interface AuthTextFieldProps extends TextInputProps {
  label: string
  testID: string
  invalid?: boolean
  passwordVisible?: boolean
  onTogglePassword?: () => void
  /** Что показываем и скрываем, в винительном падеже: «пароль», «новый пароль». */
  passwordSubject?: string
}

/**
 * Поле с подписью над ним, как на странице входа SSO.
 * На Android при фокусе меняется только рамка, как в jaco-cook-app.
 * На iOS тень постоянно задана, меняется только её прозрачность:
 * фокус не должен менять нативного родителя TextInput.
 */
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
    keyboardType,
    ...inputProps
  },
  ref
) {
  const palette = useAuthPalette()
  const keyboard = useAuthKeyboard()
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null)
  const setInputRef = useCallback((input: React.ElementRef<typeof TextInput> | null) => {
    inputRef.current = input
    if (typeof ref === 'function') ref(input)
    else if (ref) ref.current = input
  }, [ref])
  const [isFocused, setIsFocused] = useState(false)
  const borderColor = invalid ? palette.error : isFocused ? palette.crimson : palette.border

  return (
    <View>
      <Text style={[styles.label, { color: palette.label }]}>{label}</Text>
      <View
        style={[
          styles.field,
          { borderColor, backgroundColor: palette.field },
          Platform.OS === 'ios' && {
            ...styles.fieldFocused,
            shadowColor: palette.crimson,
            shadowOpacity: isFocused ? styles.fieldFocused.shadowOpacity : 0,
          },
          !editable && styles.fieldDisabled,
        ]}
        testID={`${testID}-container`}
      >
        <TextInput
          ref={setInputRef}
          {...inputProps}
          keyboardType={Platform.OS === 'ios' && keyboardType === 'phone-pad'
            ? 'numbers-and-punctuation'
            : keyboardType}
          value={value}
          editable={editable}
          style={[styles.input, onTogglePassword ? styles.inputWithToggle : null, { color: palette.ink }]}
          placeholderTextColor={palette.muted}
          selectionColor={palette.crimson}
          accessibilityLabel={label}
          testID={testID}
          onFocus={(event) => {
            setIsFocused(true)
            keyboard?.onFocus(testID, inputRef.current)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setIsFocused(false)
            keyboard?.onBlur(testID)
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
