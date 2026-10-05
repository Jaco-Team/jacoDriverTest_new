import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {YamapInstance} from 'react-native-yamap-plus';

import {initYaMap} from '@/shared/lib/yaMapInit';
import {useOfflineMapStore} from '@/features/offline-map/model/offlineMap.store';
import {findOfflineMapCity} from '@/features/offline-map/model/offlineMapCities';
import type {Order} from '@/shared/store/OrdersStoreType';
import type {XY} from '@/shared/types/globalTypes';
import {isValidMapPoint, type MapPoint} from './mapPoint';

const OFFLINE_MAP_REGISTRY_KEY = 'jaco_mapkit_offline_regions_v1';
const OFFLINE_MAP_REGISTRY_VERSION = 1;
const FAILED_SYNC_RETRY_MS = 15 * 60 * 1000;
const CATALOG_RETRY_COUNT = 6;
const CATALOG_RETRY_DELAY_MS = 2_000;

interface OfflineRegion {
  id: number;
  name: string;
  sizeBytes?: number;
  catalogError?: string;
}

interface OfflineRegionStatus {
  id: number;
  state: string;
  progress: number;
}

interface OfflinePointRegion {
  coverageKey: string;
  lastAttemptAt: number;
  lastError?: string;
  lastUsedAt: number;
  name?: string;
  regionId?: number;
  sizeBytes?: number;
  state?: string;
}

interface OfflineMapRegistry {
  version: typeof OFFLINE_MAP_REGISTRY_VERSION;
  points: Record<string, OfflinePointRegion>;
}

interface SyncInput {
  pointId: number | null;
  home: XY | null;
  orders: Order[];
}

const pendingSyncs = new Map<string, SyncInput>();
const activeSyncs = new Map<string, Promise<void>>();
let registryQueue: Promise<void> = Promise.resolve();

function emptyRegistry(): OfflineMapRegistry {
  return {version: OFFLINE_MAP_REGISTRY_VERSION, points: {}};
}

async function readRegistry(): Promise<OfflineMapRegistry> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_MAP_REGISTRY_KEY);
    if (!raw) return emptyRegistry();

    const parsed = JSON.parse(raw) as Partial<OfflineMapRegistry>;
    return parsed.version === OFFLINE_MAP_REGISTRY_VERSION && parsed.points
      ? (parsed as OfflineMapRegistry)
      : emptyRegistry();
  } catch {
    return emptyRegistry();
  }
}

function updateRegistry(
  pointKey: string,
  update: (current?: OfflinePointRegion) => OfflinePointRegion,
): Promise<void> {
  const write = registryQueue.then(async () => {
    const registry = await readRegistry();
    registry.points[pointKey] = update(registry.points[pointKey]);
    await AsyncStorage.setItem(
      OFFLINE_MAP_REGISTRY_KEY,
      JSON.stringify(registry),
    );
  });

  registryQueue = write.catch(() => undefined);
  return write;
}

function wait(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function parseNativeJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function orderPoint(order: Order): MapPoint | null {
  const lat = Number(order.xy?.lat ?? order.xy?.latitude);
  const lon = Number(order.xy?.lon ?? order.xy?.longitude);
  const point = {lat, lon};

  return isValidMapPoint(point) ? point : null;
}

function uniquePoints(points: MapPoint[]): MapPoint[] {
  const unique = new Map<string, MapPoint>();

  for (const point of points) {
    unique.set(`${point.lat.toFixed(6)}:${point.lon.toFixed(6)}`, point);
  }

  return [...unique.values()];
}

function buildCoveragePoints(home: MapPoint, orders: Order[]): MapPoint[] {
  const orderPoints = orders
    .map(orderPoint)
    .filter((point): point is MapPoint => point !== null);
  if (orderPoints.length === 0) return [home];

  const byLatitude = [...orderPoints].sort(
    (left, right) => left.lat - right.lat,
  );
  const byLongitude = [...orderPoints].sort(
    (left, right) => left.lon - right.lon,
  );

  return uniquePoints([
    home,
    byLatitude[0],
    byLatitude[byLatitude.length - 1],
    byLongitude[0],
    byLongitude[byLongitude.length - 1],
  ]);
}

function getCoverageKey(points: MapPoint[]): string {
  const latitudes = points.map(point => point.lat);
  const longitudes = points.map(point => point.lon);

  return [
    Math.min(...latitudes).toFixed(4),
    Math.max(...latitudes).toFixed(4),
    Math.min(...longitudes).toFixed(4),
    Math.max(...longitudes).toFixed(4),
  ].join(':');
}

function getPointKey(pointId: number | null, home: MapPoint): string {
  return pointId === null
    ? `coordinates:${home.lat.toFixed(5)}:${home.lon.toFixed(5)}`
    : `point:${pointId}`;
}

async function getRegionsAtPoint(
  point: MapPoint,
  waitForCatalog: boolean,
): Promise<OfflineRegion[]> {
  const attempts = waitForCatalog ? CATALOG_RETRY_COUNT : 1;
  let regions: OfflineRegion[] = [];

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    regions = parseNativeJson<OfflineRegion[]>(
      await YamapInstance.getOfflineRegionsAtPoint(point.lat, point.lon),
    );

    if (regions.some(region => Number.isFinite(region.sizeBytes))) {
      return regions;
    }

    const catalogError = regions.find(
      region => region.catalogError,
    )?.catalogError;
    if (catalogError) {
      throw new Error(catalogError);
    }

    if (attempt < attempts - 1) {
      await wait(CATALOG_RETRY_DELAY_MS);
    }
  }

  return regions;
}

async function selectRegion(points: MapPoint[]): Promise<OfflineRegion> {
  const homeRegions = (await getRegionsAtPoint(points[0], true)).filter(
    region => Number.isFinite(region.sizeBytes),
  );

  if (homeRegions.length === 0) {
    throw new Error(
      'MapKit не предоставил доступный офлайн-регион для рабочей точки.',
    );
  }

  let commonRegions = homeRegions;

  for (const point of points.slice(1)) {
    const ids = new Set(
      (await getRegionsAtPoint(point, false)).map(region => region.id),
    );
    const intersection = commonRegions.filter(region => ids.has(region.id));

    if (intersection.length === 0) {
      commonRegions = [];
      break;
    }

    commonRegions = intersection;
  }

  const candidates = commonRegions.length > 0 ? commonRegions : homeRegions;

  return [...candidates].sort((left, right) => {
    const sizeDifference = Number(left.sizeBytes) - Number(right.sizeBytes);

    if (commonRegions.length > 0) return sizeDifference;
    return -sizeDifference;
  })[0];
}

async function getRegionStatus(regionId: number): Promise<OfflineRegionStatus> {
  return parseNativeJson<OfflineRegionStatus>(
    await YamapInstance.getOfflineRegionStatus(regionId),
  );
}

async function ensureRegionDownloaded(
  regionId: number,
): Promise<OfflineRegionStatus> {
  const status = await getRegionStatus(regionId);

  if (status.state === 'unsupported') {
    throw new Error(
      'MapKit вернул unsupported для офлайн-региона. Проверьте активацию офлайн-функций и привязку платной лицензии к ключу.',
    );
  }

  if (status.state === 'completed' || status.state === 'downloading') {
    return status;
  }

  if (
    status.state === 'available' ||
    status.state === 'paused' ||
    status.state === 'outdated' ||
    status.state === 'need_update'
  ) {
    await YamapInstance.startOfflineRegionDownload(regionId);
    return getRegionStatus(regionId);
  }

  throw new Error(
    `MapKit вернул неизвестное состояние региона: ${status.state}.`,
  );
}

async function syncOnce(input: SyncInput): Promise<void> {
  if (!isValidMapPoint(input.home)) return;

  const network = await NetInfo.fetch().catch(() => null);
  if (network?.isConnected === false || network?.isInternetReachable === false)
    return;

  await useOfflineMapStore.getState().hydrate();
  const city = findOfflineMapCity(input.home);
  const cityEntry = city ? useOfflineMapStore.getState().cities[city.id] : undefined;
  // City downloads have explicit pause/delete controls. Automatic cafe sync
  // must not restart a package the user has paused or removed.
  if (cityEntry?.managed) return;

  const home = input.home;
  const points = buildCoveragePoints(home, input.orders);
  const coverageKey = getCoverageKey(points);
  const pointKey = getPointKey(input.pointId, home);
  const registry = await readRegistry();
  const current = registry.points[pointKey];

  if (
    current?.lastError &&
    current.coverageKey === coverageKey &&
    Date.now() - current.lastAttemptAt < FAILED_SYNC_RETRY_MS
  ) {
    return;
  }

  try {
    const initialized = await initYaMap();
    if (!initialized) throw new Error('MapKit не инициализировался.');

    let region: OfflineRegion;

    if (current?.regionId && current.coverageKey === coverageKey) {
      region = {
        id: current.regionId,
        name: current.name ?? `Регион ${current.regionId}`,
        sizeBytes: current.sizeBytes,
      };
    } else {
      region = await selectRegion(points);
    }

    if (city && useOfflineMapStore.getState().cities[city.id]?.managed) return;
    const status = await ensureRegionDownloaded(region.id);
    const now = Date.now();

    await updateRegistry(pointKey, () => ({
      coverageKey,
      lastAttemptAt: now,
      lastUsedAt: now,
      name: region.name,
      regionId: region.id,
      sizeBytes: region.sizeBytes,
      state: status.state,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const now = Date.now();

    await updateRegistry(pointKey, previous => ({
      coverageKey: previous?.coverageKey ?? coverageKey,
      lastAttemptAt: now,
      lastError: message,
      lastUsedAt: previous?.lastUsedAt ?? now,
      name: previous?.name,
      regionId: previous?.regionId,
      sizeBytes: previous?.sizeBytes,
      state: previous?.state,
    }));

    if (__DEV__) {
      console.info('[offline-map] MapKit sync skipped:', message);
    }
  }
}

export function scheduleMapKitOfflineSync(input: SyncInput): Promise<void> {
  if (!isValidMapPoint(input.home)) return Promise.resolve();

  const pointKey = getPointKey(input.pointId, input.home);
  pendingSyncs.set(pointKey, input);

  const active = activeSyncs.get(pointKey);
  if (active) return active;

  const task = (async () => {
    let next: SyncInput | undefined;

    while ((next = pendingSyncs.get(pointKey))) {
      pendingSyncs.delete(pointKey);
      await syncOnce(next);
    }
  })().finally(() => {
    activeSyncs.delete(pointKey);
  });

  activeSyncs.set(pointKey, task);
  return task;
}

export const MAPKIT_OFFLINE_REGISTRY_STORAGE_KEY = OFFLINE_MAP_REGISTRY_KEY;
