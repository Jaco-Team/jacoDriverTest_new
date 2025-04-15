import { useEffect } from 'react';
import { useSettingsStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow';

export function useSettingsUpdater() {
  const [getSettings] = useSettingsStore(useShallow(state => [state.getSettings]));

  useEffect(() => {
    getSettings();
    
    const interval = setInterval(() => {
      getSettings();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [getSettings]);
}