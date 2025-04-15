import React, { ReactNode } from 'react'
import { NavigationContainer } from '@react-navigation/native'

interface NavigationProviderProps {
  children: ReactNode
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  return (
    <NavigationContainer>
      {children}
    </NavigationContainer>
  )
}