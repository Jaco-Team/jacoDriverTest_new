import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DefaultTheme,
  NavigationContainer,
  NavigationState,
  ParamListBase,
} from '@react-navigation/native';
import { BackHandler } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';

import { Analytics, AnalyticsEvent } from '@/analytics/AppMetricaService';
import { RU_SCREEN_NAMES } from '@/app/navigation/types';
import { useGlobalStore } from '@/shared/store/store'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'

import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef<ParamListBase>();

const ActiveRouteNameContext = createContext('Greeting')

export function useActiveRouteName(): string {
  return useContext(ActiveRouteNameContext)
}

const AUTH_ROUTES = new Set(['Auth', 'ResetPwd'])

function getActiveRouteName(state?: NavigationState): string {
  if (!state) return 'Greeting'

  let route: any = state.routes[state.index]
  while (route?.state) route = route.state.routes[route.state.index]

  return route?.name ?? 'Greeting'
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [activeRouteName, setActiveRouteName] = useState('Greeting')
  const loadSpinner = useGlobalStore((state) => state.loadSpinner)
  const { colors, isDark } = useAppTheme()
  const backgroundColor = AUTH_ROUTES.has(activeRouteName)
    ? colors.surface
    : colors.brandHeader
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: isDark,
      colors: {
        ...DefaultTheme.colors,
        background: backgroundColor,
        card: colors.surfaceRaised,
        text: colors.text,
        border: colors.border,
        primary: colors.brand,
        notification: colors.brand,
      },
    }),
    [backgroundColor, colors, isDark],
  )

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!navigationRef.isReady()) return false

        // Greeting — технический стартовый экран. Его нельзя возвращать в
        // историю или закрывать, пока выполняется проверка авторизации.
        return navigationRef.getCurrentRoute()?.name === 'Greeting'
      },
    )

    return () => subscription.remove()
  }, [])

  return (
    <>
      <SystemBars
        style={{
          statusBar:
            loadSpinner || !AUTH_ROUTES.has(activeRouteName)
              ? 'light'
              : isDark ? 'light' : 'dark',
          navigationBar: isDark ? 'light' : 'dark',
        }}
      />

      <ActiveRouteNameContext.Provider value={activeRouteName}>
        <NavigationContainer
          ref={navigationRef}
          theme={navigationTheme}
          onReady={() => {
            const route = navigationRef.getCurrentRoute();
            const name = route?.name ?? 'Unknown';
            setActiveRouteName(name)
            const screen = RU_SCREEN_NAMES[name] ?? name;
            Analytics.setErrorContext?.('screen', screen);
            Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${screen}`);
          }}
          onStateChange={(state?: NavigationState) => {
            if (!state) return;
            const name = getActiveRouteName(state)
            setActiveRouteName(name)
            const screen = RU_SCREEN_NAMES[name] ?? name;
            Analytics.setErrorContext?.('screen', screen);
            Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${screen}`);
          }}
        >
          {children}
        </NavigationContainer>
      </ActiveRouteNameContext.Provider>
    </>
  );
}
