import React, { ReactNode } from 'react'
import { UiProvider } from './UiProviders'
import { NavigationProvider } from './NavigationProvider'

import { CustomSpinner } from '@/shared/ui/CustomSpinner'
import { CustomSpinner_hidden } from '@/shared/ui/CustomSpinner_hidden'
import { CustomAlert } from '@/shared/ui/CustomAlert'
import { ModalText } from '@/shared/ui/ModalText'
//import { ConnectivityLocationIndicator } from '@/shared/ui/ConnectivityLocationIndicator'

export function AppProviders({ children }: { children: ReactNode }) {

  //<ConnectivityLocationIndicator />

  return (
    <UiProvider>
      <NavigationProvider>
        {children}

        <CustomSpinner />
        <CustomSpinner_hidden />
        <CustomAlert />
        <ModalText />
        
        
      </NavigationProvider>
    </UiProvider>
  )
}