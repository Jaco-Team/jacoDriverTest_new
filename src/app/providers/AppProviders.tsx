import React, { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'
import { UiProvider } from './UiProviders'
import { NavigationProvider } from './NavigationProvider'

import { CustomSpinner } from '@/shared/ui/CustomSpinner'
import { CustomSpinner_hidden } from '@/shared/ui/CustomSpinner_hidden'
import { CustomAlert } from '@/shared/ui/CustomAlert'
import { ModalText } from '@/shared/ui/ModalText'
//import { ConnectivityLocationIndicator } from '@/shared/ui/ConnectivityLocationIndicator'

const rootStyle = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
})

export function AppProviders({ children }: { children: ReactNode }) {

  //<ConnectivityLocationIndicator />

  return (
    <GestureHandlerRootView style={rootStyle.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <UiProvider>
          <NavigationProvider>
            {children}

            <CustomSpinner />
            <CustomSpinner_hidden />
            <CustomAlert />
            <ModalText />
          </NavigationProvider>
        </UiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
