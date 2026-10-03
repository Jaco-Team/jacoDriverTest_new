import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useLoginStore, useSettingsStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow';
import { useIsOffline } from '@/shared/lib/connectivityContext';

export function useSettingsUpdater() {
  const isOffline = useIsOffline();
  const [getSettings] = useSettingsStore(useShallow(state => [state.getSettings]));
  const previousAppState = useRef(AppState.currentState);

  useEffect(() => {
    if (isOffline) return undefined;

    const refreshSettings = (silent = false) => {
      if (!useLoginStore.getState().currentUser) return;
      void getSettings(silent).catch(() => undefined);
    };

    refreshSettings();

    const interval = setInterval(() => {
      refreshSettings();
    }, 10 * 60 * 1000);

    const subscription = AppState.addEventListener('change', nextState => {
      const wasAway =
        previousAppState.current === 'background' ||
        previousAppState.current === 'inactive';
      previousAppState.current = nextState;
      if (wasAway && nextState === 'active') refreshSettings(true);
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [getSettings, isOffline]);
}
