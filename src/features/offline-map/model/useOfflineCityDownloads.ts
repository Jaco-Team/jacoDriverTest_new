import {useEffect, useState} from 'react';
import {AppState} from 'react-native';

import {useIsOffline} from '@/shared/lib/connectivityContext';
import {useLoginStore} from '@/shared/store/store';
import {useOfflineMapStore} from './offlineMap.store';

// Mounted once above navigation: changing screens must not stop a download.
export function useOfflineCityDownloads(): void {
  const isOffline = useIsOffline();
  const authenticated = useLoginStore(state => !!state.currentUser);
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    void useOfflineMapStore
      .getState()
      .setRuntime({online: !isOffline, authenticated, active});
  }, [isOffline, authenticated, active]);

  useEffect(() => {
    if (!active || !authenticated) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const store = useOfflineMapStore.getState();
        await store.refresh(!isOffline);
        await store.resumePending();
      } finally {
        if (!cancelled)
          timer = setTimeout(
            poll,
            useOfflineMapStore.getState().busyCityId ? 1000 : 5000,
          );
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, authenticated, isOffline]);
}
