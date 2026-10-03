import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useIsOffline } from '@/shared/lib/connectivityContext';

export function useOrdersUpdater(
  getOrders: () => void | Promise<void>,
  update_interval: number,
  getSettings?: () => void | Promise<void>,
) {
  const isOffline = useIsOffline();

  useFocusEffect(
    React.useCallback(() => {
      if (isOffline) return undefined;

      let cancelled = false;
      let intervalId: ReturnType<typeof setInterval> | undefined;
      const ms = Number(update_interval) * 1000;

      const refresh = async () => {
        // Настройки определяют выбранную точку и параметры обновления, поэтому
        // при входе сначала синхронизируем их, затем запрашиваем заказы.
        await getSettings?.();
        if (cancelled) return;

        await getOrders();
        if (cancelled || ms <= 0) return;

        intervalId = setInterval(() => void getOrders(), ms);
      };

      void refresh();

      return () => {
        cancelled = true;
        if (intervalId) clearInterval(intervalId);
      };
    }, [getOrders, getSettings, isOffline, update_interval])
  );
}
