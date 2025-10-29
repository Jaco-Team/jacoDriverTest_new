// __tests__/statistics.onRefresh.test.tsx
/**
 * onRefresh:
 * - сразу ставит isRefreshing=true и зовёт getStatistics(start,end)
 * - через 500ms (fake timers) сбрасывает isRefreshing=false
 */

import dayjs from 'dayjs';
import { render, act } from '@testing-library/react-native';

// моки стора (до импорта хука!)
jest.mock('@/shared/store/store', () => {
  const getStatistics = jest.fn();
  const useStatStore = (sel: any) =>
    sel({ getStatistics, statArr: [{ name: 'X', time2: '', other_stat: {} }] });
  const useGlobalStore = (sel: any) => sel({ globalFontSize: 16 });
  return { useStatStore, useGlobalStore };
});

// импортируем хук после моков
import { useStatisticsTable } from '@/features/statistics/model/useStatisticsTable';

describe('useStatisticsTable.onRefresh', () => {
  // доступ к возвращаемому API хука
  let api: ReturnType<typeof useStatisticsTable> | null = null;

  const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');
  const today = dayjs('2025-10-27');

  // достаём мок getStatistics из мок-стора
  const { useStatStore } = require('@/shared/store/store');
  const getStatistics: jest.Mock = useStatStore((s: any) => s).getStatistics;

  // проб-компонент, чтобы "вытащить" значения из хука
  function Probe() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    api = useStatisticsTable();
    return null as any;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-10-27T00:00:00Z'));
    jest.clearAllMocks();
    api = null;
  });

  afterEach(() => {
    try { jest.runOnlyPendingTimers(); } catch {}
    jest.useRealTimers();
  });

  it('isRefreshing -> true сразу, затем false через 500ms', () => {
    render(<Probe />);

    getStatistics.mockClear();
    expect(api!.isRefreshing).toBe(false);

    // дергаем onRefresh
    act(() => {
      api!.onRefresh();
    });

    // сразу после вызова — true и вызван getStatistics(сегодня, сегодня)
    expect(api!.isRefreshing).toBe(true);
    expect(getStatistics).toHaveBeenCalledWith(fmt(today), fmt(today));

    // через 500мс переключается обратно в false
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(api!.isRefreshing).toBe(false);
  });
});
