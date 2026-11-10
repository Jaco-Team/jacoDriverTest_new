import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('@/analytics/AppMetricaService', () => ({ Analytics: { log: jest.fn() }, AnalyticsEvent: {} }));

import { useGEOStore, useGlobalStore } from '@/shared/store/store';
import { LOCATION_WAIT_RING_LENGTH, LocationWaitCountdown } from '@/shared/ui/LocationWaitCountdown';

describe('LocationWaitCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useGlobalStore.setState({ globalFontSize: 16 });
    useGEOStore.setState({ location_wait: null });
  });

  afterEach(() => {
    useGEOStore.setState({ location_wait: null });
    jest.useRealTimers();
  });

  const ringOffset = (screen: Awaited<ReturnType<typeof render>>): number =>
    Number(screen.getByTestId('location-wait-ring-progress').props.strokeDashoffset);

  it('как на сайте: отсчитывает секунды ожидания и исчезает по окончании', async () => {
    const screen = await render(<LocationWaitCountdown />);
    expect(screen.queryByTestId('location-wait-ring')).toBeNull();

    const now = Date.now();
    await act(async () => useGEOStore.setState({
      location_wait: { deadlineAt: now + 25000, startedAt: now, firstStartedAt: now },
    }));
    expect(screen.getByTestId('location-wait-countdown')).toHaveTextContent('Определяем местоположение');
    expect(screen.getByTestId('location-wait-seconds')).toHaveTextContent('25');
    expect(screen.getByTestId('location-wait-ring').props.accessibilityLabel)
      .toBe('Определяем местоположение, осталось 25 сек.');
    // Кольцо полное в начале и убывает вместе с секундами.
    expect(ringOffset(screen)).toBeCloseTo(0, 5);

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(screen.getByTestId('location-wait-seconds')).toHaveTextContent('15');
    expect(ringOffset(screen)).toBeCloseTo(LOCATION_WAIT_RING_LENGTH * (10 / 25), 3);

    await act(async () => {
      jest.advanceTimersByTime(20000);
    });
    expect(screen.getByTestId('location-wait-countdown')).toHaveTextContent('Определяем местоположение…');
    expect(screen.queryByTestId('location-wait-seconds')).toBeNull();
    expect(ringOffset(screen)).toBeCloseTo(LOCATION_WAIT_RING_LENGTH, 5);

    await act(async () => useGEOStore.setState({ location_wait: null }));
    expect(screen.queryByTestId('location-wait-ring')).toBeNull();
  });

  it('повторная попытка не «перезаряжает» кольцо: доля считается от начала ожидания', async () => {
    const start = Date.now();
    useGEOStore.setState({ location_wait: { deadlineAt: start + 25000, startedAt: start, firstStartedAt: start } });
    const screen = await render(<LocationWaitCountdown />);

    await act(async () => {
      jest.advanceTimersByTime(15000);
    });
    const retryStart = Date.now();
    await act(async () => useGEOStore.setState({
      location_wait: { deadlineAt: retryStart + 10000, startedAt: retryStart, firstStartedAt: start },
    }));

    expect(screen.getByTestId('location-wait-seconds')).toHaveTextContent('10');
    expect(ringOffset(screen)).toBeCloseTo(LOCATION_WAIT_RING_LENGTH * (15 / 25), 3);
    screen.unmount();
  });

  it('если первая попытка сорвалась сразу, отсчёт повторной начинается с полного кольца', async () => {
    const start = Date.now();
    useGEOStore.setState({
      location_wait: { deadlineAt: start + 10000, startedAt: start, firstStartedAt: start },
    });
    const screen = await render(<LocationWaitCountdown />);

    expect(screen.getByTestId('location-wait-seconds')).toHaveTextContent('10');
    expect(ringOffset(screen)).toBeCloseTo(0, 5);
    screen.unmount();
  });
});
