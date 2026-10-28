import AsyncStorage from '@react-native-async-storage/async-storage';

import type {LaravelAuthUser} from '@/shared/api/laravel/auth';
import type {Order} from '@/shared/store/OrdersStoreType';
import type {
  MySettingsResponse,
  SettingsPoint,
  phoneType,
} from '@/shared/store/SettingsStoreType';
import type {XY} from '@/shared/types/globalTypes';

const DRIVER_OFFLINE_CACHE_KEY = 'jaco_driver_offline_cache_v1';
const DRIVER_OFFLINE_CACHE_VERSION = 1;

export interface DriverOfflineOwner {
  login: string | null;
  userId: number | null;
}

export interface DriverOfflineSettings extends MySettingsResponse {
  point_id: number | null;
  points: SettingsPoint[];
  rotate_map: boolean;
}

export interface DriverOfflineOrders {
  activeTypeId: number;
  driverNeedGps: boolean;
  home: XY | null;
  limitCount: string;
  limitSumm: string;
  ordersCache: Record<string, Order[]>;
  typeDop: string[];
  statusFilterVersion?: 2;
  updateInterval: number;
}

export interface DriverOfflineCache {
  version: typeof DRIVER_OFFLINE_CACHE_VERSION;
  savedAt: number;
  owner: DriverOfflineOwner;
  orders: DriverOfflineOrders;
  phones: phoneType | null;
  settings: DriverOfflineSettings;
}

let storageQueue: Promise<void> = Promise.resolve();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getDriverOfflineOwner(user: LaravelAuthUser): DriverOfflineOwner {
  return {
    login: user.login ?? null,
    userId: user.user_id ?? null,
  };
}

export function getDriverOfflineOwnerKey(owner: DriverOfflineOwner): string {
  return String(owner.userId ?? owner.login ?? 'session');
}

export function isDriverOfflineOwnerMatch(
  owner: DriverOfflineOwner,
  user: LaravelAuthUser,
): boolean {
  return getDriverOfflineOwnerKey(owner) === getDriverOfflineOwnerKey(
    getDriverOfflineOwner(user),
  );
}

export function createOfflineUser(owner: DriverOfflineOwner): LaravelAuthUser {
  return {
    appointment_id: null,
    city_id: null,
    login: owner.login,
    name: null,
    point_id: null,
    user_id: owner.userId,
  };
}

export type DriverOfflineCacheRead =
  | {status: 'missing'}
  | {status: 'ready'; cache: DriverOfflineCache}
  | {status: 'invalid' | 'error'};

/** Unlike the UI fallback API, preserves failed restoration as failed evidence. */
export async function readDriverOfflineCacheDetailed(): Promise<DriverOfflineCacheRead> {
  try {
    const raw = await AsyncStorage.getItem(DRIVER_OFFLINE_CACHE_KEY);
    if (raw === null) return {status: 'missing'};

    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return {status: 'invalid'}; }
    if (
      !isRecord(parsed) ||
      parsed.version !== DRIVER_OFFLINE_CACHE_VERSION ||
      !isRecord(parsed.owner) ||
      !isRecord(parsed.orders) ||
      !isRecord(parsed.settings) ||
      !isRecord(parsed.orders.ordersCache) ||
      !Array.isArray(parsed.orders.typeDop) ||
      !Array.isArray(parsed.settings.points)
    ) {
      return {status: 'invalid'};
    }

    return {status: 'ready', cache: parsed as unknown as DriverOfflineCache};
  } catch {
    return {status: 'error'};
  }
}

export async function readDriverOfflineCache(): Promise<DriverOfflineCache | null> {
  const result = await readDriverOfflineCacheDetailed();
  return result.status === 'ready' ? result.cache : null;
}

export function writeDriverOfflineCache(cache: DriverOfflineCache): Promise<void> {
  const write = storageQueue.then(() =>
    AsyncStorage.setItem(DRIVER_OFFLINE_CACHE_KEY, JSON.stringify(cache)),
  );
  storageQueue = write.catch(() => undefined);
  return write;
}

export function clearDriverOfflineCache(): Promise<void> {
  const clear = storageQueue.then(() =>
    AsyncStorage.removeItem(DRIVER_OFFLINE_CACHE_KEY),
  );
  storageQueue = clear.catch(() => undefined);
  return clear;
}

export const DRIVER_OFFLINE_CACHE_STORAGE_KEY = DRIVER_OFFLINE_CACHE_KEY;
