import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {act, render} from '@testing-library/react-native';

jest.mock('@/codePush/bootstrap', () => ({areCodePushAssetsReady: () => true}));
jest.mock('@/codePush/lifecycle', () => ({
  getCodePushLaunchState: jest.fn(),
  confirmCodePushLaunch: jest.fn(),
}));
jest.mock('@/shared/lib/yaMapInit', () => ({initYaMap: jest.fn(async () => true)}));

import {useOfflineMapStore, OFFLINE_CITY_STORAGE_KEY} from '@/features/offline-map/model/offlineMap.store';
import {
  APP_THEME_STORAGE_KEY,
  resetAppThemeHydrationForTests,
  useAppThemeStore,
} from '@/shared/theme/AppThemeProvider';
import {
  readDriverOfflineCache,
  readDriverOfflineCacheDetailed,
} from '@/shared/lib/driverOfflineCache';
import {initYaMap} from '@/shared/lib/yaMapInit';
import {codePushReadiness, isCodePushUiReady} from '@/codePush/readiness';
import {restoreCodePushLocalState, useCodePushScreenCommit} from '@/codePush/useCodePushReadiness';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  storage.getItem.mockResolvedValue(null);
  resetAppThemeHydrationForTests();
  useAppThemeStore.setState({ownerKey: null, hydrated: false, preference: 'system', restorationStatus: 'pending'});
  useOfflineMapStore.setState({hydrated: false, cities: {}, restorationStatus: 'pending', error: ''});
  jest.mocked(initYaMap).mockResolvedValue(true);
  codePushReadiness.finishRestore(codePushReadiness.getSnapshot().epoch, 'error');
  codePushReadiness.beginRestore();
  codePushReadiness.setRoute('Greeting');
});

describe('strict local restoration evidence', () => {
  it('distinguishes genuinely missing cache from corrupt bytes and storage failure', async () => {
    expect(await readDriverOfflineCacheDetailed()).toEqual({status: 'missing'});
    storage.getItem.mockResolvedValueOnce('');
    expect(await readDriverOfflineCacheDetailed()).toEqual({status: 'invalid'});
    storage.getItem.mockResolvedValueOnce('{bad json');
    expect(await readDriverOfflineCacheDetailed()).toEqual({status: 'invalid'});
    storage.getItem.mockRejectedValueOnce(new Error('secure storage unavailable'));
    expect(await readDriverOfflineCacheDetailed()).toEqual({status: 'error'});
    storage.getItem.mockRejectedValueOnce(new Error('unavailable'));
    expect(await readDriverOfflineCache()).toBeNull();
  });

  it('restores a valid empty installation without requiring network or any orders', async () => {
    expect(await restoreCodePushLocalState()).toBe(true);
    expect(useAppThemeStore.getState().restorationStatus).toBe('ready');
    expect(useOfflineMapStore.getState().restorationStatus).toBe('ready');
    expect(initYaMap).toHaveBeenCalledTimes(1);
  });

  it.each(['global-theme', 'owner-theme', 'maps', 'selected-point'] as const)('does not hide a local read failure in %s', async target => {
    const key = target === 'maps' ? OFFLINE_CITY_STORAGE_KEY
      : target === 'selected-point' ? 'selected_driver_point_id'
      : target === 'owner-theme' ? `${APP_THEME_STORAGE_KEY}:77` : APP_THEME_STORAGE_KEY;
    storage.getItem.mockImplementation(async requestedKey => {
      if (requestedKey === key) throw new Error('read failed');
      return null;
    });
    if (target === 'owner-theme') await useAppThemeStore.getState().hydrateForOwner('77');
    expect(await restoreCodePushLocalState()).toBe(false);
  });

  it.each([
    [APP_THEME_STORAGE_KEY, 'unknown-theme'],
    [OFFLINE_CITY_STORAGE_KEY, ''],
    [OFFLINE_CITY_STORAGE_KEY, '{'],
    [OFFLINE_CITY_STORAGE_KEY, JSON.stringify({version: 2, cities: {}})],
    [OFFLINE_CITY_STORAGE_KEY, JSON.stringify({version: 1, cities: []})],
    ['selected_driver_point_id', '15garbage'],
  ])('rejects malformed persisted state at %s', async (key, value) => {
    storage.getItem.mockImplementation(async requestedKey => requestedKey === key ? value : null);
    expect(await restoreCodePushLocalState()).toBe(false);
  });

  it('does not turn a failed theme read into success after a server preference is applied', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('read failed'));
    await useAppThemeStore.getState().hydrate();
    await useAppThemeStore.getState().setPreference('dark');
    expect(useAppThemeStore.getState().preference).toBe('dark');
    expect(await restoreCodePushLocalState()).toBe(false);
  });

  it('waits for the existing owner restoration instead of trusting its early hydrated flag', async () => {
    let finish!: (value: string | null) => void;
    storage.getItem.mockImplementation(async key => key === `${APP_THEME_STORAGE_KEY}:77`
      ? new Promise<string | null>(resolve => { finish = resolve; }) : null);
    const owner = useAppThemeStore.getState().hydrateForOwner('77');
    let completed = false;
    const restoration = restoreCodePushLocalState().then(value => { completed = true; return value; });
    await Promise.resolve();
    expect(completed).toBe(false);
    finish('dark');
    await owner;
    expect(await restoration).toBe(true);
    expect(useAppThemeStore.getState().preference).toBe('dark');
  });

  it('requires successful local MapKit initialization', async () => {
    jest.mocked(initYaMap).mockResolvedValueOnce(false);
    expect(await restoreCodePushLocalState()).toBe(false);
  });

  it('keeps the system theme after logout while strictly reading default theme storage', async () => {
    storage.getItem.mockImplementation(async key => key === APP_THEME_STORAGE_KEY ? 'dark' : null);
    await useAppThemeStore.getState().hydrateForOwner('77');
    useAppThemeStore.getState().clearOwner();
    expect(await restoreCodePushLocalState()).toBe(true);
    expect(useAppThemeStore.getState().preference).toBe('system');
  });
});

function ScreenCommit(): null {
  useCodePushScreenCommit('Auth');
  return null;
}

it('requires a committed matching screen after restoration, then revokes on unmount', async () => {
  const epoch = codePushReadiness.getSnapshot().epoch;
  await act(async () => {
    codePushReadiness.setRoute('Auth');
    codePushReadiness.finishRestore(epoch, 'auth-screen');
  });
  expect(isCodePushUiReady(codePushReadiness.getSnapshot())).toBe(false);
  const screen = await render(<ScreenCommit />);
  expect(isCodePushUiReady(codePushReadiness.getSnapshot())).toBe(true);
  await screen.unmount();
  expect(isCodePushUiReady(codePushReadiness.getSnapshot())).toBe(false);
});
