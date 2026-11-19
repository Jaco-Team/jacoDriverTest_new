import React, { createContext, useContext } from 'react'
import { View } from 'react-native'

import type { useKeyboardScroll } from '@/shared/ui/keyboard/useKeyboardScroll'

type AuthKeyboard = Pick<
  ReturnType<typeof useKeyboardScroll>,
  'fieldsRef' | 'onFieldsLayout' | 'onFocus' | 'onBlur'
>

export const AuthKeyboardContext = createContext<AuthKeyboard | null>(null)

export function useAuthKeyboard(): AuthKeyboard | null {
  return useContext(AuthKeyboardContext)
}

/** Measure the login/password pair together, as in the Chef login form. */
export function AuthFieldGroup({ children }: { children: React.ReactNode }): React.JSX.Element {
  const keyboard = useAuthKeyboard()

  return (
    <View ref={keyboard?.fieldsRef} collapsable={false} onLayout={keyboard?.onFieldsLayout}>
      {children}
    </View>
  )
}
