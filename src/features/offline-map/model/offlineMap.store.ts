import AsyncStorage from '@react-native-async-storage/async-storage';
import {YamapInstance} from 'react-native-yamap-plus';
import {create} from 'zustand';

import {initYaMap} from '@/shared/lib/yaMapInit';
import {
  OFFLINE_MAP_CITIES,
  getOfflineMapCity,
  type OfflineCityId,
} from './offlineMapCities';

export const OFFLINE_CITY_STORAGE_KEY = 'jaco_mapkit_city_downloads_v1';
type DownloadState =
  'available' | 'downloading' | 'paused' | 'ready' | 'outdated' | 'error';
export interface CityDownload {
  regionId?: number;
  sizeBytes?: number;
  status: DownloadState;
  progress: number;
  savedAt?: number;
  error?: string;
  autoResume: boolean;
  // Includes deleted packages: automatic cafe sync must respect user intent.
  managed: boolean;
}
interface Runtime {
  online: boolean;
  authenticated: boolean;
  active: boolean;
}
interface OfflineMapState {
  hydrated: boolean;
  selectedCityId: string;
  cities: Partial<Record<OfflineCityId, CityDownload>>;
  busyCityId: OfflineCityId | null;
  deletingCityId: OfflineCityId | null;
  error: string;
  runtime: Runtime;
  hydrate: () => Promise<void>;
  selectCity: (id: string) => void;
  refresh: (discover?: boolean) => Promise<void>;
  download: (id: OfflineCityId, refresh?: boolean) => Promise<void>;
  pause: (id: OfflineCityId, autoResume?: boolean) => Promise<void>;
  remove: (id: OfflineCityId) => Promise<void>;
  setRuntime: (runtime: Runtime) => Promise<void>;
  resumePending: () => Promise<void>;
}
interface NativeRegion {
  id: number;
  name: string;
  sizeBytes?: number;
  catalogError?: string;
}
interface NativeStatus {
  id: number;
  state: string;
  progress: number;
  error?: string;
}

let hydration: Promise<void> | null = null;
let commands = Promise.resolve();
let writes = Promise.resolve();
let refreshing: Promise<void> | null = null;
let nextCatalogAttempt = 0;
let lastPersistedValue = '';

function serialize(action: () => Promise<void>): Promise<void> {
  const task = commands.then(action);
  commands = task.catch(() => undefined);
  return task;
}
function canDownload() {
  const {online, authenticated, active} = useOfflineMapStore.getState().runtime;
  return online && authenticated && active;
}
function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
function updateCity(id: OfflineCityId, changes: Partial<CityDownload>) {
  const state = useOfflineMapStore.getState();
  useOfflineMapStore.setState({
    cities: {
      ...state.cities,
      [id]: {
        status: 'available',
        progress: 0,
        autoResume: false,
        managed: false,
        ...state.cities[id],
        ...changes,
      },
    },
  });
}
function persist(): Promise<void> {
  const {selectedCityId, cities} = useOfflineMapStore.getState();
  const value = JSON.stringify({version: 1, selectedCityId, cities});
  if (value === lastPersistedValue) return writes;
  lastPersistedValue = value;
  const write = writes.then(() =>
    AsyncStorage.setItem(OFFLINE_CITY_STORAGE_KEY, value),
  );
  writes = write.catch(() => undefined);
  return write.catch(() => {
    lastPersistedValue = '';
    useOfflineMapStore.setState({
      error: 'Не удалось сохранить состояние карт на устройстве.',
    });
  });
}
async function findRegion(id: OfflineCityId): Promise<NativeRegion> {
  const city = getOfflineMapCity(id)!;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const regions = JSON.parse(
      await YamapInstance.getOfflineRegionsAtPoint(
        city.center.lat,
        city.center.lon,
      ),
    ) as NativeRegion[];
    const region = regions.find(
      item => item.name === city.name && Number.isFinite(item.sizeBytes),
    );
    if (region) return region;
    const error = regions.find(item => item.catalogError)?.catalogError;
    if (error) throw new Error(error);
    if (!canDownload())
      throw new Error('Для скачивания нужен интернет и активная сессия.');
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Карта «${city.name}» пока недоступна. Повторите попытку.`);
}
async function readStatus(id: OfflineCityId) {
  const entry = useOfflineMapStore.getState().cities[id];
  if (!entry?.regionId) return;
  const native = JSON.parse(
    await YamapInstance.getOfflineRegionStatus(entry.regionId),
  ) as NativeStatus;
  if (native.id !== entry.regionId || !Number.isFinite(native.progress)) {
    throw new Error('Не удалось проверить сохранённую карту.');
  }
  const progress = Math.min(1, Math.max(0, native.progress));
  if (native.error || native.state === 'unsupported') {
    updateCity(id, {
      status: 'error',
      progress,
      // A persisted region can report unsupported while MapKit warms up.
      // Keep pending intent; a genuine unsupported region remains in error
      // and is never resumed until the SDK reports an available/paused state.
      autoResume: native.error ? false : entry.autoResume,
      error:
        native.error ||
        'Офлайн-карта больше не поддерживается. Удалите её и скачайте снова.',
    });
  } else if (native.state === 'completed') {
    updateCity(id, {
      status: 'ready',
      progress: 1,
      autoResume: false,
      savedAt: entry.savedAt ?? Date.now(),
      error: undefined,
    });
  } else if (native.state === 'downloading') {
    updateCity(id, {status: 'downloading', progress, error: undefined});
  } else if (native.state === 'paused') {
    updateCity(id, {
      status: 'paused',
      progress,
      error: undefined,
    });
  } else if (native.state === 'outdated' || native.state === 'need_update') {
    updateCity(id, {
      status: 'outdated',
      progress,
      autoResume: false,
      error: undefined,
    });
  } else if (native.state === 'available') {
    updateCity(id, {
      status: entry.autoResume ? 'paused' : 'available',
      progress: 0,
      savedAt: undefined,
      error: undefined,
    });
  } else {
    throw new Error('Не удалось проверить состояние карты.');
  }
}

export const useOfflineMapStore = create<OfflineMapState>((set, get) => ({
  hydrated: false,
  selectedCityId: '',
  cities: {},
  busyCityId: null,
  deletingCityId: null,
  error: '',
  runtime: {online: false, authenticated: false, active: false},
  hydrate: () => {
    if (get().hydrated) return Promise.resolve();
    if (!hydration)
      hydration = (async () => {
        try {
          const raw = await AsyncStorage.getItem(OFFLINE_CITY_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (
              parsed.version === 1 &&
              parsed.cities &&
              typeof parsed.cities === 'object'
            ) {
              const cities: OfflineMapState['cities'] = {};
              for (const city of OFFLINE_MAP_CITIES) {
                const entry = parsed.cities[city.id];
                if (
                  !entry ||
                  !Number.isFinite(entry.progress) ||
                  ![
                    'available',
                    'downloading',
                    'paused',
                    'ready',
                    'outdated',
                    'error',
                  ].includes(entry.status)
                )
                  continue;
                cities[city.id] = {
                  ...entry,
                  status:
                    entry.status === 'downloading' ? 'paused' : entry.status,
                  regionId:
                    Number.isInteger(entry.regionId) && entry.regionId > 0
                      ? entry.regionId
                      : undefined,
                  autoResume: entry.autoResume === true,
                  managed: entry.managed === true,
                };
              }
              set({
                cities,
                selectedCityId:
                  getOfflineMapCity(parsed.selectedCityId)?.id ?? '',
              });
            }
          }
        } catch {
          set({error: 'Не удалось прочитать сохранённые карты.'});
        }
        set({hydrated: true});
      })().finally(() => {
        hydration = null;
      });
    return hydration;
  },
  selectCity: id => {
    if (!getOfflineMapCity(id)) return;
    set({selectedCityId: id});
    void persist();
  },
  refresh: (discover = false) => {
    if (refreshing) return refreshing;
    refreshing = serialize(async () => {
      await get().hydrate();
      if (!(await initYaMap())) return;
      const shouldDiscover =
        discover && canDownload() && Date.now() >= nextCatalogAttempt;
      if (shouldDiscover) nextCatalogAttempt = Date.now() + 30_000;
      for (const city of OFFLINE_MAP_CITIES) {
        try {
          if (!get().cities[city.id]?.regionId && shouldDiscover) {
            const region = await findRegion(city.id);
            updateCity(city.id, {
              regionId: region.id,
              sizeBytes: region.sizeBytes,
            });
          }
          await readStatus(city.id);
        } catch (error) {
          if (get().cities[city.id]?.regionId)
            updateCity(city.id, {
              status: 'error',
              error: message(error),
              autoResume: false,
            });
        }
      }
      const downloading = OFFLINE_MAP_CITIES.find(
        city => get().cities[city.id]?.status === 'downloading',
      );
      set({busyCityId: downloading?.id ?? null});
      await persist();
    }).finally(() => {
      refreshing = null;
    });
    return refreshing;
  },
  download: async (id, refresh = false) => {
    await get().hydrate();
    if (
      !getOfflineMapCity(id) ||
      get().busyCityId ||
      get().deletingCityId ||
      !canDownload()
    )
      return;
    set({busyCityId: id, error: ''});
    updateCity(id, {
      status: 'downloading',
      managed: true,
      autoResume: true,
      error: undefined,
      ...(refresh ? {progress: 0, savedAt: undefined} : {}),
    });
    await persist();
    await serialize(async () => {
      try {
        if (!(await initYaMap()))
          throw new Error('Карта не инициализировалась. Повторите попытку.');
        const entry = get().cities[id];
        if (!entry?.regionId || refresh) {
          const region = await findRegion(id);
          updateCity(id, {regionId: region.id, sizeBytes: region.sizeBytes});
        }
        // Network loss / manual pause while the catalog was being fetched.
        if (!canDownload() || !get().cities[id]?.autoResume) {
          updateCity(id, {status: 'paused'});
          set({busyCityId: null});
          return;
        }
        const regionId = get().cities[id]!.regionId!;
        const status = JSON.parse(
          await YamapInstance.getOfflineRegionStatus(regionId),
        ) as NativeStatus;
        if (!canDownload() || !get().cities[id]?.autoResume) {
          updateCity(id, {status: 'paused'});
          set({busyCityId: null});
          return;
        }
        if (status.state === 'completed' && !refresh) await readStatus(id);
        else {
          await YamapInstance.startOfflineRegionDownload(regionId);
          await readStatus(id);
        }
        if (get().cities[id]?.status !== 'downloading') set({busyCityId: null});
      } catch (error) {
        updateCity(id, {
          status: canDownload() ? 'error' : 'paused',
          error: canDownload() ? message(error) : undefined,
          autoResume: !canDownload(),
        });
        set({busyCityId: null});
      } finally {
        await persist();
      }
    });
  },
  pause: async (id, autoResume = false) => {
    const entry = get().cities[id];
    if (!entry) return;
    updateCity(id, {status: 'paused', autoResume, managed: true});
    await persist();
    await serialize(async () => {
      try {
        const current = get().cities[id];
        if (current?.regionId)
          await YamapInstance.pauseOfflineRegionDownload(current.regionId);
        if (get().busyCityId === id) set({busyCityId: null});
      } catch (error) {
        updateCity(id, {
          status: 'error',
          error: message(error),
          autoResume: false,
        });
      }
      await persist();
    });
  },
  remove: async id => {
    if (!getOfflineMapCity(id) || get().busyCityId || get().deletingCityId)
      return;
    set({deletingCityId: id, error: ''});
    await serialize(async () => {
      try {
        const entry = get().cities[id];
        if (entry?.regionId)
          await YamapInstance.removeOfflineRegion(entry.regionId);
        updateCity(id, {
          status: 'available',
          progress: 0,
          savedAt: undefined,
          error: undefined,
          autoResume: false,
          managed: true,
        });
      } catch (error) {
        set({error: message(error)});
      } finally {
        set({deletingCityId: null});
        await persist();
      }
    });
  },
  setRuntime: async runtime => {
    // An empty session on cold startup is not a logout. Keep persisted download
    // intent while secure storage and the offline session are being restored.
    const loggedOut = get().runtime.authenticated && !runtime.authenticated;
    set({runtime});
    await get().hydrate();
    if (!canDownload()) {
      await Promise.all(
        OFFLINE_MAP_CITIES.map(async city => {
          const entry = get().cities[city.id];
          if (
            entry?.status === 'downloading' ||
            (loggedOut && entry?.autoResume)
          ) {
            await get().pause(
              city.id,
              !loggedOut && (entry.autoResume || !entry.managed),
            );
          }
        }),
      );
    } else {
      await get().refresh(true);
      await get().resumePending();
    }
  },
  resumePending: async () => {
    if (!canDownload() || get().busyCityId || get().deletingCityId) return;
    const pending = OFFLINE_MAP_CITIES.find(city => {
      const entry = get().cities[city.id];
      return entry?.autoResume && entry.status === 'paused';
    });
    if (pending) await get().download(pending.id);
  },
}));
