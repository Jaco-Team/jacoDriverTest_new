import React, { useEffect } from 'react'

import { useFocusEffect } from '@react-navigation/native';

export function useUserLocationUpdater(checkMyPos: () => void) {
  useFocusEffect(
    React.useCallback(() => {
      const intervalId = setInterval(() => {
        checkMyPos();
      }, 30 * 1000);

      return () => clearInterval(intervalId);
    }, [checkMyPos])
  );

  useEffect(() => {
    checkMyPos();
  }, [checkMyPos]);
}