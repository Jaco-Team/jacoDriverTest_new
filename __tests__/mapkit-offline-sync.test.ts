import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {YamapInstance} from 'react-native-yamap-plus';

import {
  MAPKIT_OFFLINE_REGISTRY_STORAGE_KEY,
  scheduleMapKitOfflineSync,
} from '@/features/orders-map/model/mapKitOfflineSync';
import type {Order} from '@/shared/store/OrdersStoreType';
import type {XY} from '@/shared/types/globalTypes';
import {useOfflineMapStore} from '@/features/offline-map/model/offlineMap.store';

jest.mock('@/shared/lib/yaMapInit', () => ({
  initYaMap: jest.fn(async () => true),
}));

const home = {lat: 53.2, lon: 50.1} as XY;
const order = {xy: {lat: 53.21, lon: 50.11}} as Order;
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const netInfo = NetInfo as jest.Mocked<typeof NetInfo>;
const native = YamapInstance as typeof YamapInstance & {
  getOfflineRegionsAtPoint: jest.Mock;
  getOfflineRegionStatus: jest.Mock;
  startOfflineRegionDownload: jest.Mock;
};

function savedRegistry() {
  const call = storage.setItem.mock.calls.find(
    ([key]) => key === MAPKIT_OFFLINE_REGISTRY_STORAGE_KEY,
  );
  return call ? JSON.parse(call[1]) : null;
}

describe('MapKit offline region sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOfflineMapStore.setState({hydrated: true, cities: {}});
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
    netInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);
    native.getOfflineRegionsAtPoint = jest.fn(async () =>
      JSON.stringify([
        {id: 1, name: 'Большой', sizeBytes: 2000},
        {id: 2, name: 'Малый', sizeBytes: 1000},
      ]),
    );
    native.getOfflineRegionStatus = jest.fn(async () =>
      JSON.stringify({id: 2, state: 'completed', progress: 1}),
    );
    native.startOfflineRegionDownload = jest.fn(async () => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not initialize MapKit when offline or without valid coordinates', async () => {
    await scheduleMapKitOfflineSync({pointId: 101, home: null, orders: []});
    netInfo.fetch.mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);
    await scheduleMapKitOfflineSync({pointId: 101, home, orders: []});

    expect(native.getOfflineRegionsAtPoint).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('selects the smallest shared region and records completed state', async () => {
    await scheduleMapKitOfflineSync({pointId: 102, home, orders: [order]});

    expect(native.getOfflineRegionsAtPoint).toHaveBeenCalledTimes(2);
    expect(native.getOfflineRegionStatus).toHaveBeenCalledWith(2);
    expect(native.startOfflineRegionDownload).not.toHaveBeenCalled();
    expect(savedRegistry().points['point:102']).toMatchObject({
      regionId: 2,
      name: 'Малый',
      state: 'completed',
    });
  });

  it('starts an available region download and saves its new state', async () => {
    native.getOfflineRegionStatus
      .mockResolvedValueOnce(JSON.stringify({id: 2, state: 'available', progress: 0}))
      .mockResolvedValueOnce(JSON.stringify({id: 2, state: 'downloading', progress: 0}));

    await scheduleMapKitOfflineSync({pointId: 103, home, orders: []});

    expect(native.startOfflineRegionDownload).toHaveBeenCalledWith(2);
    expect(savedRegistry().points['point:103'].state).toBe('downloading');
  });

  it('falls back to the largest home region when no region covers every order', async () => {
    native.getOfflineRegionsAtPoint
      .mockResolvedValueOnce(
        JSON.stringify([
          {id: 1, name: 'Большой', sizeBytes: 2000},
          {id: 2, name: 'Малый', sizeBytes: 1000},
        ]),
      )
      .mockResolvedValueOnce(JSON.stringify([{id: 3, name: 'Другой', sizeBytes: 500}]));

    await scheduleMapKitOfflineSync({pointId: 105, home, orders: [order]});

    expect(native.getOfflineRegionStatus).toHaveBeenCalledWith(1);
    expect(savedRegistry().points['point:105'].regionId).toBe(1);
  });

  it('reuses the saved region for unchanged coverage', async () => {
    storage.getItem.mockImplementation(async () => {
      const call = storage.setItem.mock.lastCall;
      return call?.[1] ?? null;
    });
    await scheduleMapKitOfflineSync({pointId: 106, home, orders: []});
    await scheduleMapKitOfflineSync({pointId: 106, home, orders: []});

    expect(native.getOfflineRegionsAtPoint).toHaveBeenCalledTimes(1);
    expect(native.getOfflineRegionStatus).toHaveBeenCalledTimes(2);
  });

  it('respects a manually paused or deleted city package', async () => {
    useOfflineMapStore.setState({cities: {samara: {regionId: 51, status: 'available', progress: 0, managed: true, autoResume: false}}});
    await scheduleMapKitOfflineSync({pointId: 107, home, orders: [order]});
    expect(native.getOfflineRegionsAtPoint).not.toHaveBeenCalled();
    expect(native.startOfflineRegionDownload).not.toHaveBeenCalled();
  });

  it('reselects the region after a failed coverage change instead of reusing the old region', async () => {
    const disk = new Map<string, string>();
    storage.getItem.mockImplementation(async key => disk.get(key) ?? null);
    storage.setItem.mockImplementation(async (key, value) => {disk.set(key, value);});
    native.getOfflineRegionsAtPoint
      .mockResolvedValueOnce(JSON.stringify([{id: 2, name: 'Old', sizeBytes: 1000}]))
      .mockRejectedValueOnce(new Error('Catalog temporarily unavailable'))
      .mockResolvedValue(JSON.stringify([{id: 3, name: 'New', sizeBytes: 2000}]));
    native.getOfflineRegionStatus.mockImplementation(async id => JSON.stringify({id, state: 'completed', progress: 1}));
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    await scheduleMapKitOfflineSync({pointId: 108, home, orders: []});
    const changedHome = {lat: 53.3, lon: 50.2} as XY;
    await scheduleMapKitOfflineSync({pointId: 108, home: changedHome, orders: []});
    await scheduleMapKitOfflineSync({pointId: 108, home: changedHome, orders: []});
    expect(JSON.parse(disk.get(MAPKIT_OFFLINE_REGISTRY_STORAGE_KEY)!).points['point:108'].regionId).toBe(3);
  });

  it('records unsupported errors and delays retry for unchanged coverage', async () => {
    native.getOfflineRegionStatus.mockResolvedValue(
      JSON.stringify({id: 2, state: 'unsupported', progress: 0}),
    );
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    storage.getItem.mockImplementation(async () => {
      const call = storage.setItem.mock.lastCall;
      return call?.[1] ?? null;
    });

    await scheduleMapKitOfflineSync({pointId: 104, home, orders: []});
    expect(savedRegistry().points['point:104'].lastError).toContain('unsupported');
    await scheduleMapKitOfflineSync({pointId: 104, home, orders: []});
    expect(native.getOfflineRegionsAtPoint).toHaveBeenCalledTimes(1);
    expect(native.getOfflineRegionStatus).toHaveBeenCalledTimes(1);
  });
});
