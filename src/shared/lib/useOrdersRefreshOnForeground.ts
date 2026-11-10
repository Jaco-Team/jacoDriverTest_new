import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isAppOffline } from '@/shared/lib/connectivityState';
import { useOrdersStore } from '@/shared/store/store';

/**
 * Как на сайте: сразу обновляет заказы, когда курьер возвращается в приложение.
 * В фоне таймер автообновления не работает, и без этого уведомление об
 * отменённых заказах пришло бы только со следующим тиком таймера.
 */
export function useOrdersRefreshOnForeground(isEnabled: boolean) {
  useEffect(() => {
    if (!isEnabled) return undefined;

    let previousState: AppStateStatus = AppState.currentState;

    const subscription = AppState.addEventListener('change', nextState => {
      const wasAway = previousState === 'background' || previousState === 'inactive';
      previousState = nextState;

      if (!wasAway || nextState !== 'active' || isAppOffline()) return;

      const { isClick, getOrders } = useOrdersStore.getState();
      // Действие с заказом само обновит список после ответа.
      if (isClick) return;

      void getOrders(false);
    });

    return () => subscription.remove();
  }, [isEnabled]);
}
