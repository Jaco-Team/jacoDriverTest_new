import { useEffect } from 'react';
import { useStatStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow';
import { useIsOffline } from '@/shared/lib/connectivityContext';

export function useAvgTimeUpdater(isNeedAvgTime: boolean) {
  const isOffline = useIsOffline();
  const [getAvgTime] = useStatStore(useShallow(state => [state.getAvgTime]));

  useEffect(() => {
    if (isNeedAvgTime && !isOffline) {
      getAvgTime();
      const interval = setInterval(() => {
        getAvgTime();
      }, 120 * 1000);
      return () => clearInterval(interval);
    }
  }, [getAvgTime, isNeedAvgTime, isOffline]);
}
