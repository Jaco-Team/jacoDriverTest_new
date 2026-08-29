import React, { forwardRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'

function PasswordVisibilityIcon({ passwordVisible }: { passwordVisible: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill="#68747D"
        d={
          passwordVisible
            ? 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92A11.94 11.94 0 0 0 23 12c-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7ZM2.27 3.27 4.45 5.45l.43.43A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42 2.73 2.73 1.27-1.27L3.54 2 2.27 3.27Zm5.26 5.26 1.55 1.55c-.05.3-.08.6-.08.92a3 3 0 0 0 3 3c.32 0 .62-.03.92-.08l1.55 1.55a5 5 0 0 1-6.94-6.94Zm4.31.49 3.15 3.15.02-.16a3 3 0 0 0-3-3l-.17.01Z'
            : 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5Zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'
        }
      />
    </Svg>
  )
}

interface AuthTextFieldProps extends Omit<TextInputProps, 'placeholder'> {
  label: string
  testID: string
  passwordVisible?: boolean
  onTogglePassword?: () => void
}

export const AuthTextField = forwardRef<
  React.ElementRef<typeof TextInput>,
  AuthTextFieldProps
>(function AuthTextField(
  {
    label,
    testID,
    value,
    secureTextEntry,
    passwordVisible = false,
    onTogglePassword,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false)
  const isLabelFloating = isFocused || Boolean(value)

  return (
    <View
      style={[styles.field, isFocused && styles.fieldFocused]}
      testID={`${testID}-container`}
    >
      <TextInput
        ref={ref}
        {...inputProps}
        value={value}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        selectionColor="#1F1015"
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

      <Text
        pointerEvents="none"
        style={isLabelFloating ? styles.floatingLabel : styles.restingLabel}
      >
        {label}
      </Text>

      {onTogglePassword ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'}
          hitSlop={10}
          style={styles.passwordToggle}
          testID="auth-password-toggle"
          onPress={onTogglePassword}
        >
          <PasswordVisibilityIcon passwordVisible={passwordVisible} />
        </Pressable>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  field: {
    position: 'relative',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
    borderWidth: 1,
    borderColor: 'rgba(37, 18, 22, 0.09)',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#181114',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  fieldFocused: {
    borderWidth: 2,
    borderColor: '#CC0033',
  },
  input: {
    minWidth: 0,
    minHeight: 56,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    color: '#1F1015',
    fontFamily: 'Roboto-Regular',
    fontSize: 16,
    includeFontPadding: false,
    lineHeight: 20,
    textAlignVertical: 'center',
  },
  restingLabel: {
    position: 'absolute',
    top: 18,
    left: 14,
    color: 'rgba(64, 79, 92, 0.72)',
    fontFamily: 'Roboto-Medium',
    fontSize: 16,
    lineHeight: 20,
  },
  floatingLabel: {
    position: 'absolute',
    top: -9,
    left: 12,
    paddingHorizontal: 4,
    backgroundColor: '#FFFFFF',
    color: 'rgba(64, 79, 92, 0.72)',
    fontFamily: 'Roboto-Medium',
    fontSize: 12,
    lineHeight: 18,
  },
  passwordToggle: {
    width: 48,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
