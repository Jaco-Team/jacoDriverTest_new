import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import NetInfo, {type NetInfoState} from '@react-native-community/netinfo';

import {appPalette} from '@/shared/styles/appPalette';
import {
  ConnectivityContext,
  useIsOffline,
} from '@/shared/lib/connectivityContext';
import {setAppOffline} from '@/shared/lib/connectivityState';
import {useGlobalStore, useOrdersStore} from '@/shared/store/store';

export {useIsOffline} from '@/shared/lib/connectivityContext';

export const CONNECTIVITY_REFRESH_INTERVAL_MS = 15_000;

export function isOfflineNetworkState(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

export function ConnectivityProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [isOffline, setIsOffline] = useState(false);
  const previousOfflineRef = useRef(false);
  const recoveryPendingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const applyNetworkState = (state: NetInfoState) => {
      if (isMounted) {
        const networkIsOffline = isOfflineNetworkState(state);

        if (networkIsOffline) {
          recoveryPendingRef.current = true;
        }

        const isConfirmedOnline =
          state.isConnected === true && state.isInternetReachable === true;
        const nextIsOffline =
          networkIsOffline ||
          (recoveryPendingRef.current && !isConfirmedOnline);
        const wasOffline = previousOfflineRef.current;
        previousOfflineRef.current = nextIsOffline;
        setAppOffline(nextIsOffline);
        setIsOffline(nextIsOffline);

        if (nextIsOffline) {
          useGlobalStore.getState().setSpinner(false);
          useGlobalStore.getState().setSpinnerHidden(false);
          useOrdersStore.setState({
            is_check: false,
            ordersRefreshPending: false,
          });
        } else if (wasOffline && isConfirmedOnline) {
          recoveryPendingRef.current = false;
          // Данные восстанавливает только открытый экран. Если запускать здесь
          // getOrders и снимать паузу фонового прогрева, то одновременно с
          // focus-обновлением стартует несколько запросов, а уже посещённые
          // экраны также начинают загружаться все разом.
        }
      }
    };

    const refreshNetworkState = async () => {
      try {
        applyNetworkState(await NetInfo.refresh());
      } catch {
        // Сохраняем последнее известное состояние: ошибка самой проверки
        // ещё не означает, что интернет действительно отсутствует.
      }
    };

    const unsubscribe = NetInfo.addEventListener(applyNetworkState);
    void refreshNetworkState();

    const refreshTimer = setInterval(
      refreshNetworkState,
      CONNECTIVITY_REFRESH_INTERVAL_MS,
    );

    return () => {
      isMounted = false;
      clearInterval(refreshTimer);
      unsubscribe();
    };
  }, []);

  return (
    <ConnectivityContext.Provider value={isOffline}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export const ConnectivityLocationIndicator: React.FC = () => {
  const isOffline = useIsOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <View
      accessibilityLiveRegion="assertive"
      pointerEvents="none"
      style={styles.container}
      testID="offline-status-banner">
      <Text accessibilityRole="alert" style={styles.text}>
        Нет подключения к интернету
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 8,
    marginVertical: 6,
    minHeight: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: appPalette.brandDeep,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
