import AsyncStorage from '@react-native-async-storage/async-storage'
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useColorScheme } from 'react-native'
import { create } from 'zustand'

import {
  appPalettes,
  type AppPalette,
} from '@/shared/styles/appPalette'

export type AppThemePreference = 'system' | 'light' | 'dark'
export type AppColorScheme = 'light' | 'dark'

export const APP_THEME_STORAGE_KEY = 'jaco_driver_app_theme_v1'

interface AppThemeState {
  preference: AppThemePreference
  previewPreference: AppThemePreference | null
  ownerKey: string | null
  hydrated: boolean
  hasStoredPreference: boolean
  hydrate: () => Promise<void>
  hydrateForOwner: (ownerKey: string) => Promise<void>
  clearOwner: () => void
  setPreference: (preference: AppThemePreference) => Promise<void>
  setPreviewPreference: (preference: AppThemePreference) => void
  clearPreviewPreference: () => void
  applyServerPreference: (preference: unknown) => Promise<void>
  migrateFromNightMap: (nightMap: unknown) => Promise<void>
}

let hydrationPromise: Promise<void> | null = null

function isThemePreference(value: unknown): value is AppThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function resolveAppColorScheme(
  preference: AppThemePreference,
  systemScheme: 'light' | 'dark' | null | undefined,
): AppColorScheme {
  return preference === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : preference
}

export const useAppThemeStore = create<AppThemeState>()((set, get) => ({
  preference: 'system',
  previewPreference: null,
  ownerKey: null,
  hydrated: false,
  hasStoredPreference: false,

  hydrate: async () => {
    if (get().hydrated) return

    if (!hydrationPromise) {
      hydrationPromise = (async () => {
        try {
          const storedPreference = await AsyncStorage.getItem(APP_THEME_STORAGE_KEY)
          if (get().ownerKey === null && isThemePreference(storedPreference)) {
            set({
              preference: storedPreference,
              hasStoredPreference: true,
            })
          }
        } finally {
          if (get().ownerKey === null) set({ hydrated: true })
        }
      })().finally(() => {
        hydrationPromise = null
      })
    }

    await hydrationPromise
  },

  hydrateForOwner: async ownerKey => {
    if (get().ownerKey === ownerKey) return
    set({ ownerKey, preference: 'system', previewPreference: null, hydrated: true, hasStoredPreference: false })
    const stored = await AsyncStorage.getItem(`${APP_THEME_STORAGE_KEY}:${ownerKey}`).catch(() => null)
    if (get().ownerKey === ownerKey && isThemePreference(stored)) {
      set({ preference: stored, hasStoredPreference: true })
    }
  },

  clearOwner: () => {
    set({ ownerKey: null, preference: 'system', previewPreference: null, hydrated: true, hasStoredPreference: false })
  },

  setPreference: async preference => {
    set({ preference, hydrated: true, hasStoredPreference: true })
    const key = get().ownerKey
    await AsyncStorage.setItem(key ? `${APP_THEME_STORAGE_KEY}:${key}` : APP_THEME_STORAGE_KEY, preference)
  },

  setPreviewPreference: previewPreference => set({ previewPreference }),
  clearPreviewPreference: () => set({ previewPreference: null }),

  applyServerPreference: async preference => {
    if (isThemePreference(preference)) {
      await get().setPreference(preference)
    }
  },

  migrateFromNightMap: async nightMap => {
    await get().hydrate()

    // Старое значение 1 однозначно означает выбранную пользователем тёмную
    // карту. Ноль мог быть серверным значением по умолчанию, поэтому он не
    // должен отменять новое поведение «как на устройстве».
    if (!get().hasStoredPreference && Number(nightMap) === 1) {
      await get().setPreference('dark')
    }
  },
}))

interface AppThemeContextValue {
  preference: AppThemePreference
  deviceScheme: AppColorScheme
  resolvedScheme: AppColorScheme
  isDark: boolean
  colors: AppPalette
  setPreference: (preference: AppThemePreference) => Promise<void>
  setPreviewPreference: (preference: AppThemePreference) => void
  clearPreviewPreference: () => void
}

const defaultThemeContext: AppThemeContextValue = {
  preference: 'system',
  deviceScheme: 'light',
  resolvedScheme: 'light',
  isDark: false,
  colors: appPalettes.light,
  setPreference: async () => undefined,
  setPreviewPreference: () => undefined,
  clearPreviewPreference: () => undefined,
}

const AppThemeContext = createContext<AppThemeContextValue>(defaultThemeContext)

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const preference = useAppThemeStore(state => state.previewPreference ?? state.preference)
  const hydrate = useAppThemeStore(state => state.hydrate)
  const setPreference = useAppThemeStore(state => state.setPreference)
  const setPreviewPreference = useAppThemeStore(state => state.setPreviewPreference)
  const clearPreviewPreference = useAppThemeStore(state => state.clearPreviewPreference)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const deviceScheme: AppColorScheme = resolveAppColorScheme('system', systemScheme)
  const resolvedScheme = resolveAppColorScheme(preference, systemScheme)

  const value = useMemo<AppThemeContextValue>(() => ({
    preference,
    deviceScheme,
    resolvedScheme,
    isDark: resolvedScheme === 'dark',
    colors: appPalettes[resolvedScheme],
    setPreference,
    setPreviewPreference,
    clearPreviewPreference,
  }), [clearPreviewPreference, deviceScheme, preference, resolvedScheme, setPreference, setPreviewPreference])

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  )
}

export function useAppTheme(): AppThemeContextValue {
  return useContext(AppThemeContext)
}

export async function migrateAppThemeFromNightMap(nightMap: unknown): Promise<void> {
  await useAppThemeStore.getState().migrateFromNightMap(nightMap)
}

export function resetAppThemeHydrationForTests(): void {
  hydrationPromise = null
}
