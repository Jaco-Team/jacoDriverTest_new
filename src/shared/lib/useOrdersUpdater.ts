import React, { useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export function useOrdersUpdater(getOrders: () => void, update_interval: number) {
  useFocusEffect(
    React.useCallback(() => {
      const ms = Number(update_interval) * 1000;

      if (ms > 0) {
        const id = setInterval(() => getOrders(), ms);
        return () => clearInterval(id);
      }
      return undefined; // интервал не создаём
    }, [update_interval, getOrders])
  );

  // разовый вызов на входе
  useEffect(() => {
    getOrders();
  }, [getOrders]);
}
