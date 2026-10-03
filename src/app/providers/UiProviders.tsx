import React, { ReactNode } from 'react'
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { useAppTheme } from '@/shared/theme/AppThemeProvider'

interface UiProviderProps {
  children: ReactNode
}

export function UiProvider({ children }: UiProviderProps) {
  const { preference } = useAppTheme()

  return (
    <GluestackUIProvider mode={preference}>
      {children}
    </GluestackUIProvider>
  )
}
