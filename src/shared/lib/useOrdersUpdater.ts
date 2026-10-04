import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export function useOrdersUpdater(getOrders: () => void, update_interval: number) {
  useFocusEffect(
    React.useCallback(() => {
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') getOrders();
      });
      const ms = Number(update_interval) * 1000;

      if (ms > 0) {
        const id = setInterval(() => getOrders(), ms);
        return () => { clearInterval(id); subscription.remove(); };
      }
      return () => subscription.remove();
    }, [update_interval, getOrders])
  );

  // разовый вызов на входе
  useEffect(() => {
    getOrders();
  }, [getOrders]);
}
