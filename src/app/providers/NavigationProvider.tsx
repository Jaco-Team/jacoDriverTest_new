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

function getNavigationBackground(routeName: string): string {
  return AUTH_ROUTES.has(routeName) ? '#F4F7FA' : '#CC0033'
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [backgroundColor, setBackgroundColor] = useState('#CC0033')
  const [activeRouteName, setActiveRouteName] = useState('Greeting')
  const loadSpinner = useGlobalStore((state) => state.loadSpinner)
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: backgroundColor,
      },
    }),
    [backgroundColor],
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
              : 'dark',
          navigationBar: 'dark',
        }}
      />

      <ActiveRouteNameContext.Provider value={activeRouteName}>
        <NavigationContainer
          ref={navigationRef}
          theme={navigationTheme}
          onReady={() => {
            const route = navigationRef.getCurrentRoute();
            const name = route?.name ?? 'Unknown';
            setBackgroundColor(getNavigationBackground(name))
            setActiveRouteName(name)
            const screen = RU_SCREEN_NAMES[name] ?? name;
            Analytics.setErrorContext?.('screen', screen);
            Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${screen}`);
          }}
          onStateChange={(state?: NavigationState) => {
            if (!state) return;
            const name = getActiveRouteName(state)
            setBackgroundColor(getNavigationBackground(name))
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
