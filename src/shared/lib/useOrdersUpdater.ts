import React, { useEffect } from 'react'

import { useFocusEffect } from '@react-navigation/native';

export function useOrdersUpdater(getOrders: () => void, update_interval: number) {
  useFocusEffect(
    React.useCallback(() => {
      const intervalId = setInterval(() => {
        getOrders();
      }, update_interval * 1000);

      return () => clearInterval(intervalId);
    }, [update_interval, getOrders])
  );

  useEffect(() => {
    getOrders();
  }, [getOrders]);
}