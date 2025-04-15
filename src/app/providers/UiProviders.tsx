import React, { ReactNode } from 'react'
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

interface UiProviderProps {
  children: ReactNode
}

export function UiProvider({ children }: UiProviderProps) {
  return (
    <GluestackUIProvider>
      {children}
    </GluestackUIProvider>
  )
}