import React, { ReactNode } from 'react';
import { NavigationContainer, NavigationState } from '@react-navigation/native';

import { Analytics, AnalyticsEvent } from '@/analytics/AppMetricaService';
import { RU_SCREEN_NAMES } from '@/app/navigation/types';

import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();

export function NavigationProvider({ children }: { children: ReactNode }) {
  return (
    <NavigationContainer
      ref={navigationRef}
      
      onReady={() => {
        const route = navigationRef.getCurrentRoute();
        const name = route?.name ?? 'Unknown';
        const screen = RU_SCREEN_NAMES[name] ?? name;
        Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${screen}`);
      }}

      onStateChange={(state?: NavigationState) => {
        if (!state) return;
        let r: any = state.routes[state.index];
        while (r?.state) r = r.state.routes[r.state.index];
        const name = r?.name ?? 'Unknown';
        const screen = RU_SCREEN_NAMES[name] ?? name;
        Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${screen}`);
      }}
      
    >
      {children}
    </NavigationContainer>
  );
}
