import React from 'react'

import { useFocusEffect } from '@react-navigation/native';
import { useIsOffline } from '@/shared/lib/connectivityContext';

export function useUserLocationUpdater(checkMyPos: () => void) {
  const isOffline = useIsOffline();

  useFocusEffect(
    React.useCallback(() => {
      if (isOffline) return undefined;

      checkMyPos();
      const intervalId = setInterval(() => {
        checkMyPos();
      }, 30 * 1000);

      return () => clearInterval(intervalId);
    }, [checkMyPos, isOffline])
  );
}
