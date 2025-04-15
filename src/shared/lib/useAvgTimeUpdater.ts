import { useEffect } from 'react';
import { useStatStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow';

export function useAvgTimeUpdater(isNeedAvgTime: boolean) {
  const [getAvgTime] = useStatStore(useShallow(state => [state.getAvgTime]));

  useEffect(() => {
    if (isNeedAvgTime) {
      getAvgTime();
      const interval = setInterval(() => {
        getAvgTime();
      }, 120 * 1000);
      return () => clearInterval(interval);
    }
  }, [isNeedAvgTime, getAvgTime]);
}