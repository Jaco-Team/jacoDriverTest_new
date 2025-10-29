// __tests__/useStatisticsTable.range.test.tsx
import React from 'react';
import dayjs from 'dayjs';
import { render, act } from '@testing-library/react-native';

// ==== Моки стора: showAlertText доступен и через selector, и через getState ====
jest.mock('@/shared/store/store', () => {
  const getStatistics = jest.fn();
  const showAlertText = jest.fn();

  const useStatStore = (selector: any) =>
    selector({ getStatistics, statArr: [] });

  const useGlobalStore: any = (selector: any) =>
    selector({ globalFontSize: 16, showAlertText }); // <-- селектор тоже видит функцию

  useGlobalStore.getState = () => ({ globalFontSize: 16, showAlertText }); // <-- и через getState

  return { useStatStore, useGlobalStore };
});

// Аналитика (в chooseDateStart/End остаются логи)
jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: jest.fn() },
  AnalyticsEvent: {
    StatisticsCalendarStartClose: 'StatisticsCalendarStartClose',
    StatisticsCalendarEndClose: 'StatisticsCalendarEndClose',
    StatisticsDateSelected: 'StatisticsDateSelected',
  },
}));

// Важно импортировать хук ПОСЛЕ моков
import { useStatisticsTable } from '@/features/statistics/model/useStatisticsTable';

describe('useStatisticsTable: нормализация дат, алёрты и вызовы getStatistics', () => {
  const fixedToday = dayjs('2025-10-27');
  const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');
  const minDate = fixedToday.startOf('day').subtract(93, 'day');

  let api: ReturnType<typeof useStatisticsTable> | null = null;

  function Probe() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    api = useStatisticsTable();
    return null as any;
  }

  const { useStatStore, useGlobalStore } = require('@/shared/store/store');
  const getStatistics: jest.Mock = useStatStore((s: any) => s).getStatistics;
  const showAlertText: jest.Mock = useGlobalStore.getState().showAlertText;

  beforeEach(() => {
    jest.useFakeTimers();
    // Полдень по UTC, чтобы не ловить сдвиги дат
    jest.setSystemTime(new Date('2025-10-27T12:00:00Z'));
    jest.clearAllMocks();
    api = null;
  });

  afterEach(() => {
    // На всякий случай, чтобы воркер завершался без ворнингов
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('маунт: сразу вызывает getStatistics(сегодня, сегодня)', () => {
    render(<Probe />);

    expect(getStatistics).toHaveBeenCalledTimes(1);
    expect(getStatistics).toHaveBeenLastCalledWith(fmt(fixedToday), fmt(fixedToday));
    expect(api!.dateStart).toBe(fmt(fixedToday));
    expect(api!.dateEnd).toBe(fmt(fixedToday));
  });

  it('chooseDateStart: раньше минимума → подрезаем до [minDate; today], показываем алёрт', () => {
    render(<Probe />);
    getStatistics.mockClear();
    showAlertText.mockClear();

    act(() => {
      api!.chooseDateStart('2025-01-01'); // слишком рано
    });

    expect(getStatistics).toHaveBeenCalledTimes(1);
    expect(getStatistics).toHaveBeenLastCalledWith(fmt(minDate), fmt(fixedToday));
    expect(api!.dateStart).toBe(fmt(minDate));
    expect(api!.dateEnd).toBe(fmt(fixedToday));

    expect(showAlertText).toHaveBeenCalledTimes(1);
    const [visible, msg] = showAlertText.mock.calls[0];
    expect(visible).toBe(true);
    expect(String(msg)).toContain('Выбран период:');
    expect(String(msg)).toContain(fmt(minDate));
    expect(String(msg)).toContain(fmt(fixedToday));
  });

  it('chooseDateEnd: дата в будущем → конец = сегодня (старт не меняем, если span ≤ 93)', () => {
    render(<Probe />);

    act(() => {
      api!.chooseDateStart(fixedToday.subtract(20, 'day').toDate());
    });
    getStatistics.mockClear();

    act(() => {
      api!.chooseDateEnd('2025-12-31'); // будущее
    });

    expect(getStatistics).toHaveBeenCalledTimes(1);
    expect(api!.dateEnd).toBe(fmt(fixedToday));
    expect(api!.dateStart).toBe(fmt(fixedToday.subtract(20, 'day')));
  });

  it('диапазон > 93 дней: конец далеко вперёд → сдвигаем обе границы под правило 93 дней', () => {
    render(<Probe />);

    act(() => {
      api!.chooseDateStart('2025-06-01'); // рано
    });
    getStatistics.mockClear();

    act(() => {
      api!.chooseDateEnd('2025-12-31'); // сильно вперёд
    });

    expect(getStatistics).toHaveBeenCalledTimes(1);
    expect(api!.dateEnd).toBe(fmt(fixedToday));
    expect(api!.dateStart).toBe(fmt(minDate)); // today - 93
  });

  it('конец раньше старта: chooseDateEnd < start → конец поднимается до старта', () => {
    render(<Probe />);

    act(() => {
      api!.chooseDateStart('2025-10-20');
    });
    getStatistics.mockClear();

    act(() => {
      api!.chooseDateEnd('2025-10-10');
    });

    expect(getStatistics).toHaveBeenCalledTimes(1);
    expect(api!.dateStart).toBe('2025-10-20');
    expect(api!.dateEnd).toBe('2025-10-20');
  });

  it('валидные даты без нормализации → алёрт не показывается', () => {
    render(<Probe />);
    showAlertText.mockClear();

    act(() => {
      api!.chooseDateStart(fixedToday.subtract(10, 'day').toDate());
    });
    act(() => {
      api!.chooseDateEnd(fixedToday.subtract(5, 'day').toDate());
    });

    expect(showAlertText).not.toHaveBeenCalled();
  });
});
