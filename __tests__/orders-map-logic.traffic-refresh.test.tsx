import React from 'react';
import { act, render } from '@testing-library/react-native';

const mockUseIsFocused = jest.fn();
const mockAnalyticsLog = jest.fn();

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useIsFocused: () => mockUseIsFocused(),
    useFocusEffect: (callback: any) => {
      React.useEffect(() => (typeof callback === 'function' ? callback() : undefined), [callback]);
    },
  };
});

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: (...args: any[]) => mockAnalyticsLog(...args) },
  AnalyticsEvent: {
    MapHomeCenter: 'MapHomeCenter',
  },
}));

import { useMapLogic } from '@/features/orders-map/model/useMapLogic';
import { useGEOStore, useOrdersStore, useSettingsStore } from '@/shared/store/store';
import { resetYaMapInit } from '@/shared/lib/yaMapInit';

describe('useMapLogic: traffic layer and refresh behavior', () => {
  let api: ReturnType<typeof useMapLogic> | null = null;
  const getOrders = jest.fn();
  const getSettings = jest.fn();
  const showModalTypeDop = jest.fn();
  const showLocationDriver = jest.fn();
  const setRotateMap = jest.fn();
  const setTrafficVisible = jest.fn();
  const setZoom = jest.fn();
  const setCenter = jest.fn();
  const attachMapRef = () => {
    (api!.mapRef as React.MutableRefObject<any>).current = {
      setTrafficVisible,
      setZoom,
      setCenter,
    };
  };

  function Probe() {
    api = useMapLogic();
    return null as any;
  }

  async function renderProbe() {
    const view = render(<Probe />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    return view;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetYaMapInit();
    api = null;
    mockUseIsFocused.mockReturnValue(true);

    useSettingsStore.setState({
      getSettings,
      night_map: 0,
      is_scaleMap: 1,
      rotate_map: false,
      setRotateMap,
    } as any);
    useOrdersStore.setState({
      getOrders,
      home: { lon: 20.5, lat: 54.7 },
      update_interval: 2,
      showModalTypeDop,
      is_showModalTypeDop: false,
      types_dop: [
        { id: 1, text: 'В очереди' },
        { id: 2, text: 'Готовится' },
        { id: 3, text: 'Собран' },
      ],
      type_dop: ['1', '2', '3'],
      isOpenOrderMap: false,
      mapHomeCenterRequestId: 0,
    } as any);
    useGEOStore.setState({
      showLocationDriver,
      set_type_location: jest.fn(),
      type_location: 'none',
    } as any);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('toggles Yandex traffic layer through map ref and exposes current state', async () => {
    const view = await renderProbe();
    attachMapRef();

    expect(api!.trafficVisible).toBe(false);

    act(() => {
      api!.toggleTrafficVisible();
    });

    expect(setTrafficVisible).toHaveBeenCalledWith(true);
    expect(api!.trafficVisible).toBe(true);

    act(() => {
      api!.toggleTrafficVisible();
    });

    expect(setTrafficVisible).toHaveBeenCalledWith(false);
    expect(api!.trafficVisible).toBe(false);
    view.unmount();
  });

  it('loads map data on focus and refreshes orders by update_interval while focused', async () => {
    const view = await renderProbe();
    attachMapRef();

    expect(getOrders).toHaveBeenCalledWith();
    expect(getSettings).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2_000);
    });

    expect(getOrders).toHaveBeenCalledWith(false);
    view.unmount();
  });

  it('does not start interval refresh when screen is not focused', async () => {
    mockUseIsFocused.mockReturnValue(false);

    const view = await renderProbe();

    expect(getOrders).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(6_000);
    });

    expect(getOrders).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('updates native map zoom and centers on home point', async () => {
    const view = await renderProbe();
    attachMapRef();

    await act(async () => {
      await api!.updateZoom(14);
    });

    expect(setZoom).toHaveBeenCalledWith(14, 0, 0);
    expect(api!.zoom).toBe(14);

    act(() => {
      api!.getHome();
    });

    expect(setCenter).toHaveBeenCalledWith({ lon: 20.5, lat: 54.7 }, 12, 0, 0, 0, 0);
    view.unmount();
  });

  it('centers map after native onMapLoaded and exposes ready-to-render flag', async () => {
    const view = await renderProbe();
    attachMapRef();

    expect(api!.mapInitStatus).toBe('ready');

    act(() => {
      api!.handleMapLoaded();
    });

    expect(api!.isMapLoaded).toBe(true);
    expect(setCenter).toHaveBeenCalledWith({ lon: 20.5, lat: 54.7 }, 12, 0, 0, 0, 0);
    view.unmount();
  });

  it('does not recenter after load when server only refreshes the same home point', async () => {
    const view = await renderProbe();
    attachMapRef();

    act(() => {
      api!.handleMapLoaded();
    });

    setCenter.mockClear();

    act(() => {
      useOrdersStore.setState({
        home: { lon: 20.5, lat: 54.7 },
      } as any);
    });

    expect(setCenter).not.toHaveBeenCalled();
    view.unmount();
  });

  it('recenters to home only when take/cancel requested it via settings', async () => {
    const view = await renderProbe();
    attachMapRef();

    act(() => {
      api!.handleMapLoaded();
    });

    setCenter.mockClear();

    act(() => {
      useOrdersStore.setState({
        mapHomeCenterRequestId: 1,
      } as any);
    });

    expect(setCenter).toHaveBeenCalledWith({ lon: 20.5, lat: 54.7 }, 12, 0, 0, 0, 0);
    view.unmount();
  });

  it('does not render map until the screen is focused', async () => {
    mockUseIsFocused.mockReturnValue(false);

    const view = await renderProbe();

    expect(api!.shouldRenderMap).toBe(false);
    view.unmount();
  });
});
