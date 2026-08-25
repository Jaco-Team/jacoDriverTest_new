// __tests__/useOrdersUpdater.no-interval.test.tsx

/**
 * Проверяем хук useOrdersUpdater(getOrders, interval):
 * - interval = 0 ⇒ getOrders вызывается один раз на маунте, дальше таймер не тикает
 * - interval > 0 ⇒ getOrders тикает по интервалу, а после unmount больше не вызывается
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';

// --- лёгкие моки окружения ДО импорта хука ---

// react-native (минимум)
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (s: any) => ('ios' in s ? s.ios : s.default) },
  AppState: {
    addEventListener: (_: any, __: any) => ({ remove: () => {} }),
  },
}));

// NetInfo: сразу «интернет есть»
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: (cb: any) => {
    cb({ isConnected: true, type: 'wifi', details: {} });
    return () => {};
  },
  fetch: async () => ({ isConnected: true }),
}));

// Навигация: useFocusEffect → один раз как useEffect
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: any) => {
      React.useEffect(() => (typeof cb === 'function' ? cb() : undefined), [cb]);
    },
  };
});

// --- импортируем сам хук ---
const { useOrdersUpdater } = require('@/shared/lib/useOrdersUpdater');

// Тестовая обёртка, чтобы прогнать хук
function TestComp({
  getOrders,
  interval,
}: {
  getOrders: () => void;
  interval: number;
}) {
  useOrdersUpdater(getOrders, interval);
  return null as any;
}

describe('useOrdersUpdater: поведение интервала', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('при interval=0: getOrders ровно 1 раз и больше не тикает', async () => {
    const getOrders = jest.fn();

    const { unmount } = await render(<TestComp getOrders={getOrders} interval={0} />);

    // вызов на маунте
    expect(getOrders).toHaveBeenCalledTimes(1);

    // проматываем время — ничего не должно добавиться
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(getOrders).toHaveBeenCalledTimes(1);

    // после unmount тоже тишина
    await unmount();
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(getOrders).toHaveBeenCalledTimes(1);
  });

  it('при interval>0: тикает по интервалу и останавливается после unmount', async () => {
    const getOrders = jest.fn();
    const intervalSec = 2; // секунды
    const TICK = intervalSec * 1_000;

    const { unmount } = await render(
      <TestComp getOrders={getOrders} interval={intervalSec} />
    );

    // вызов на маунте
    expect(getOrders).toHaveBeenCalledTimes(1);

    // три тика по 2 секунды
    await act(async () => {
      jest.advanceTimersByTime(3 * TICK);
    });
    expect(getOrders).toHaveBeenCalledTimes(1 + 3);

    // unmount — новых вызовов быть не должно
    await unmount();
    const callsBefore = getOrders.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(5 * TICK);
    });
    expect(getOrders).toHaveBeenCalledTimes(callsBefore);
  });
});
