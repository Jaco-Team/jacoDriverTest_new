import AsyncStorage from '@react-native-async-storage/async-storage';
import {useEffect, useSyncExternalStore} from 'react';
import {AppState} from 'react-native';

import {useOfflineMapStore} from '@/features/offline-map/model/offlineMap.store';
import {useAppThemeStore} from '@/shared/theme/AppThemeProvider';
import {initYaMap} from '@/shared/lib/yaMapInit';
import {areCodePushAssetsReady} from './bootstrap';
import {confirmCodePushLaunch, getCodePushLaunchState} from './lifecycle';
import {
  codePushReadiness,
  createCodePushReadyRunner,
  type CodePushReadyScreen,
} from './readiness';

/** Only local restoration/SDK initialization: no successful API request is required. */
export async function restoreCodePushLocalState(): Promise<boolean> {
  try {
    const theme = useAppThemeStore.getState();
    if (theme.ownerKey === null) await theme.hydrate();
    else await theme.hydrateForOwner(theme.ownerKey);
    await useOfflineMapStore.getState().hydrate();
    const selectedPoint = await AsyncStorage.getItem('selected_driver_point_id');
    if (selectedPoint !== null && !/^[1-9]\d*$/.test(selectedPoint)) return false;
    if (useAppThemeStore.getState().restorationStatus !== 'ready' ||
        useOfflineMapStore.getState().restorationStatus !== 'ready') return false;
    return await initYaMap();
  } catch {
    return false;
  }
}

const runner = createCodePushReadyRunner({
  getLaunchState: getCodePushLaunchState,
  confirmLaunch: confirmCodePushLaunch,
  restoreLocalState: restoreCodePushLocalState,
  assetsReady: areCodePushAssetsReady,
});

/** Mounted once above screens for ACK only; native startup owns the network check. */
export function CodePushReadinessLifecycle(): null {
  useEffect(() => {
    if (__DEV__) return;
    const update = () => runner.update(
      codePushReadiness.getSnapshot(), AppState.currentState === 'active',
    );
    const unsubscribe = codePushReadiness.subscribe(update);
    const subscription = AppState.addEventListener('change', state => {
      runner.update(codePushReadiness.getSnapshot(), state === 'active');
    });
    update();
    return () => {
      unsubscribe();
      subscription.remove();
      runner.update(codePushReadiness.getSnapshot(), false);
    };
  }, []);
  return null;
}

/** Passive effect proves the actual screen committed after the latest boot restoration. */
export function useCodePushScreenCommit(screen: CodePushReadyScreen): void {
  const snapshot = useSyncExternalStore(
    codePushReadiness.subscribe, codePushReadiness.getSnapshot, codePushReadiness.getSnapshot,
  );
  useEffect(() => {
    if (snapshot.route !== screen) return;
    codePushReadiness.commitScreen(screen, snapshot.epoch);
    return () => codePushReadiness.unmountScreen(screen, snapshot.epoch);
  }, [screen, snapshot.epoch, snapshot.outcome, snapshot.route]);
}
