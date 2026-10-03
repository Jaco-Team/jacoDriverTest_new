import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { ConnectivityContext } from '@/shared/lib/connectivityContext';

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

const mockGetAvgTime = jest.fn();
const mockGetSettings = jest.fn();
let mockCurrentUser: {user_id: number} | null;
let appStateListener: ((state: AppStateStatus) => void) | null;
const mockRemoveAppStateListener = jest.fn();

let mockStatState: any;
let mockSettingsState: any;

jest.mock('@/shared/store/store', () => ({
  useStatStore: (selector: any) => selector(mockStatState),
  useSettingsStore: (selector: any) => selector(mockSettingsState),
  useLoginStore: {
    getState: () => ({currentUser: mockCurrentUser}),
  },
}));

import { useAvgTimeUpdater } from '@/shared/lib/useAvgTimeUpdater';
import { useSettingsUpdater } from '@/shared/lib/useSettingsUpdater';

describe('shared updater hooks', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStatState = {
      getAvgTime: mockGetAvgTime,
    };
    mockSettingsState = {
      getSettings: mockGetSettings,
    };
    mockCurrentUser = {user_id: 1};
    appStateListener = null;
    mockGetSettings.mockResolvedValue(undefined);
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event, listener) => {
      appStateListener = listener as (state: AppStateStatus) => void;
      return {remove: mockRemoveAppStateListener};
    }) as typeof AppState.addEventListener);
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('useAvgTimeUpdater: при disabled не вызывает getAvgTime', async () => {
    function Probe() {
      useAvgTimeUpdater(false);
      return null as any;
    }

    await render(<Probe />);

    await act(async () => {
      jest.advanceTimersByTime(5 * 120_000);
    });

    expect(mockGetAvgTime).not.toHaveBeenCalled();
  });

  it('useAvgTimeUpdater: при enabled вызывает сразу и каждые 120 секунд, cleanup останавливает interval', async () => {
    function Probe() {
      useAvgTimeUpdater(true);
      return null as any;
    }

    const { unmount } = await render(<Probe />);

    expect(mockGetAvgTime).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(3 * 120_000);
    });

    expect(mockGetAvgTime).toHaveBeenCalledTimes(4);

    await unmount();
    await act(async () => {
      jest.advanceTimersByTime(2 * 120_000);
    });

    expect(mockGetAvgTime).toHaveBeenCalledTimes(4);
  });

  it('useSettingsUpdater: вызывает getSettings сразу и каждые 10 минут, cleanup останавливает interval', async () => {
    function Probe() {
      useSettingsUpdater();
      return null as any;
    }

    const { unmount } = await render(<Probe />);

    expect(mockGetSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(2 * 10 * 60_000);
    });

    expect(mockGetSettings).toHaveBeenCalledTimes(3);

    await unmount();
    await act(async () => {
      jest.advanceTimersByTime(10 * 60_000);
    });

    expect(mockGetSettings).toHaveBeenCalledTimes(3);
    expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);
  });

  it('обновляет настройки без спиннера при возврате приложения на экран', async () => {
    function Probe() {
      useSettingsUpdater();
      return null as any;
    }

    const {unmount} = await render(<Probe />);
    expect(mockGetSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      appStateListener?.('background');
      appStateListener?.('active');
    });
    expect(mockGetSettings).toHaveBeenNthCalledWith(2, true);

    await act(async () => appStateListener?.('active'));
    expect(mockGetSettings).toHaveBeenCalledTimes(2);
    await unmount();
  });

  it('после восстановления сети обновляет настройки, но не делает запрос после выхода', async () => {
    function Probe({offline}: {offline: boolean}) {
      return (
        <ConnectivityContext.Provider value={offline}>
          <Updater />
        </ConnectivityContext.Provider>
      );
    }
    function Updater() {
      useSettingsUpdater();
      return null as any;
    }

    const view = await render(<Probe offline />);
    expect(mockGetSettings).not.toHaveBeenCalled();

    await view.rerender(<Probe offline={false} />);
    expect(mockGetSettings).toHaveBeenCalledTimes(1);

    mockCurrentUser = null;
    await act(async () => {
      appStateListener?.('background');
      appStateListener?.('active');
      jest.advanceTimersByTime(10 * 60_000);
    });
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
    await view.unmount();
  });
});
