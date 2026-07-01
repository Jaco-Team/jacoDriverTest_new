import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

const mockGetAvgTime = jest.fn();
const mockGetSettings = jest.fn();

let mockStatState: any;
let mockSettingsState: any;

jest.mock('@/shared/store/store', () => ({
  useStatStore: (selector: any) => selector(mockStatState),
  useSettingsStore: (selector: any) => selector(mockSettingsState),
}));

import { useAvgTimeUpdater } from '@/shared/lib/useAvgTimeUpdater';
import { useSettingsUpdater } from '@/shared/lib/useSettingsUpdater';

describe('shared updater hooks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStatState = {
      getAvgTime: mockGetAvgTime,
    };
    mockSettingsState = {
      getSettings: mockGetSettings,
    };
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('useAvgTimeUpdater: при disabled не вызывает getAvgTime', () => {
    function Probe() {
      useAvgTimeUpdater(false);
      return null as any;
    }

    render(<Probe />);

    act(() => {
      jest.advanceTimersByTime(5 * 120_000);
    });

    expect(mockGetAvgTime).not.toHaveBeenCalled();
  });

  it('useAvgTimeUpdater: при enabled вызывает сразу и каждые 120 секунд, cleanup останавливает interval', () => {
    function Probe() {
      useAvgTimeUpdater(true);
      return null as any;
    }

    const { unmount } = render(<Probe />);

    expect(mockGetAvgTime).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(3 * 120_000);
    });

    expect(mockGetAvgTime).toHaveBeenCalledTimes(4);

    unmount();
    act(() => {
      jest.advanceTimersByTime(2 * 120_000);
    });

    expect(mockGetAvgTime).toHaveBeenCalledTimes(4);
  });

  it('useSettingsUpdater: вызывает getSettings сразу и каждые 10 минут, cleanup останавливает interval', () => {
    function Probe() {
      useSettingsUpdater();
      return null as any;
    }

    const { unmount } = render(<Probe />);

    expect(mockGetSettings).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2 * 10 * 60_000);
    });

    expect(mockGetSettings).toHaveBeenCalledTimes(3);

    unmount();
    act(() => {
      jest.advanceTimersByTime(10 * 60_000);
    });

    expect(mockGetSettings).toHaveBeenCalledTimes(3);
  });
});
