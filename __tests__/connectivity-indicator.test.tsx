import React from 'react';
import {act, render, screen} from '@testing-library/react-native';

const mockListeners = new Set<(state: any) => void>();
const mockRefresh = jest.fn();
const mockAddEventListener = jest.fn((listener: (state: any) => void) => {
  mockListeners.add(listener);
  listener({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: {},
  });
  return () => mockListeners.delete(listener);
});

jest.mock('@react-native-community/netinfo', () => {
  const NetInfo = {
    addEventListener: (listener: (state: any) => void) =>
      mockAddEventListener(listener),
    refresh: () => mockRefresh(),
  };

  return {__esModule: true, default: NetInfo, ...NetInfo};
});

import {
  CONNECTIVITY_REFRESH_INTERVAL_MS,
  ConnectivityLocationIndicator,
  ConnectivityProvider,
  isOfflineNetworkState,
} from '@/shared/ui/ConnectivityLocationIndicator';

const onlineState = {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi',
  details: {},
};

describe('ConnectivityLocationIndicator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockListeners.clear();
    mockAddEventListener.mockClear();
    mockRefresh.mockReset().mockResolvedValue(onlineState);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('считает офлайном отсутствие сети или недоступность интернета', () => {
    expect(
      isOfflineNetworkState({
        isConnected: false,
        isInternetReachable: false,
      } as any),
    ).toBe(true);
    expect(
      isOfflineNetworkState({
        isConnected: true,
        isInternetReachable: false,
      } as any),
    ).toBe(true);
    expect(
      isOfflineNetworkState({
        isConnected: true,
        isInternetReachable: null,
      } as any),
    ).toBe(false);
  });

  it('показывает плашку при потере сети и скрывает после восстановления', async () => {
    const view = await render(
      <ConnectivityProvider>
        <ConnectivityLocationIndicator />
      </ConnectivityProvider>,
    );

    expect(screen.queryByTestId('offline-status-banner')).toBeNull();

    await act(async () => {
      mockListeners.forEach(listener =>
        listener({
          isConnected: false,
          isInternetReachable: false,
          type: 'none',
          details: null,
        }),
      );
    });

    expect(screen.getByText('Нет подключения к интернету')).toBeTruthy();

    await act(async () => {
      mockListeners.forEach(listener => listener(onlineState));
    });

    expect(screen.queryByTestId('offline-status-banner')).toBeNull();
    await view.unmount();
  });

  it('принудительно перепроверяет сеть по таймеру и очищает его', async () => {
    const view = await render(
      <ConnectivityProvider>
        <ConnectivityLocationIndicator />
      </ConnectivityProvider>,
    );

    await act(async () => undefined);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(CONNECTIVITY_REFRESH_INTERVAL_MS);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(2);

    await view.unmount();

    await act(async () => {
      jest.advanceTimersByTime(CONNECTIVITY_REFRESH_INTERVAL_MS);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });
});
