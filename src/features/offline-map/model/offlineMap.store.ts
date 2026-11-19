import AsyncStorage from '@react-native-async-storage/async-storage';
import {YamapInstance} from 'react-native-yamap-plus';
import {create} from 'zustand';

import {isOfflineCityUsable} from './offlineMapAvailability';
import {getOfflineMapErrorMessage} from './offlineMapError';
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
  // Independent of a new download, its progress, pause or error.
  availability?: 'checking' | 'ready' | 'missing' | 'invalid';
  needsUpdate?: boolean;
  nativeState?: string;
  usableReleaseTime?: number;
  updating?: boolean;
  preparing?: boolean;
  // Command acceptance is not confirmation that a new package was installed.
  awaitingStart?: boolean;
  regionId?: number;
  sizeBytes?: number;
  status: DownloadState;
  progress: number;
  savedAt?: number;
  // Failure of the last explicit request, independent of installed SDK data.
  downloadError?: string;
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
  restorationStatus: 'pending' | 'ready' | 'error';
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
  // False only while the SDK cannot yet distinguish an unknown region from an unsupported one.
  stateKnown?: boolean;
  progress: number;
  error?: string;
  downloadedReleaseTime?: number | null;
  availableReleaseTime?: number | null;
  downloadStarted?: boolean;
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
  return getOfflineMapErrorMessage(error);
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
  let entry = useOfflineMapStore.getState().cities[id];
  if (!entry?.regionId) return;
  const native = JSON.parse(
    await YamapInstance.getOfflineRegionStatus(entry.regionId),
  ) as NativeStatus;
  if (native.id !== entry.regionId || !Number.isFinite(native.progress)) {
    throw new Error('Не удалось проверить сохранённую карту.');
  }
  // A manual pause can happen while the native status promise is in flight.
  entry = useOfflineMapStore.getState().cities[id];
  if (!entry || entry.regionId !== native.id) return;
  if (native.stateKnown === false) {
    // Startup can report unsupported before the local catalog is loaded.
    // Preserve download intent, errors and installed metadata until SDK confirms the state.
    updateCity(id, {nativeState: native.state, availability: 'checking'});
    return;
  }
  const progress = Math.min(1, Math.max(0, native.progress));
  const release = typeof native.downloadedReleaseTime === 'number' &&
    Number.isFinite(native.downloadedReleaseTime) && native.downloadedReleaseTime > 0
    ? native.downloadedReleaseTime : undefined;
  // While updating, only a previously verified installed release can remain
  // usable. A date/progress value alone is not evidence of a valid old map.
  const previousReleaseUsable = release !== undefined && release === entry.usableReleaseTime;
  const availableRelease = typeof native.availableReleaseTime === 'number' &&
    Number.isFinite(native.availableReleaseTime) && native.availableReleaseTime > 0
    ? native.availableReleaseTime : undefined;
  const newerReleaseAvailable = release !== undefined && availableRelease !== undefined &&
    availableRelease > release;
  const installedMatchesCatalog = native.state === 'completed' &&
    release !== undefined && availableRelease !== undefined && release >= availableRelease;
  const snapshot = {
    nativeState: native.state, progress, preparing: false, awaitingStart: false,
  };
  if (entry.preparing && entry.awaitingStart && previousReleaseUsable && !native.error &&
      (native.state === 'completed' || native.state === 'outdated') &&
      !installedMatchesCatalog && (!native.downloadStarted || newerReleaseAvailable)) {
    // A command returning is not a completed download. Retain the request while
    // SDK still describes the old package. No timer fabricates success/failure.
    updateCity(id, {
      nativeState: native.state, availability: 'ready',
      needsUpdate: native.state === 'outdated' || newerReleaseAvailable,
    });
    return;
  }
  if (native.state === 'completed' || native.state === 'outdated') {
    // Completed can describe the OLD installed package after a failed update.
    // Only a new attempt or a newly installed release clears that failure.
    const newRelease = release !== undefined && entry.usableReleaseTime !== undefined &&
      release !== entry.usableReleaseTime;
    const attemptError = newRelease ? undefined :
      native.error ? message(native.error) : entry.downloadError;
    const failedAttempt = Boolean(attemptError);
    const resumeUpdate = !failedAttempt && !newRelease && !installedMatchesCatalog &&
      entry.status === 'paused' && entry.autoResume && entry.updating === true;
    updateCity(id, {
      ...snapshot,
      status: failedAttempt ? 'error' : resumeUpdate ? 'paused' :
        native.state === 'completed' && !newerReleaseAvailable ? 'ready' : 'outdated',
      availability: 'ready',
      needsUpdate: native.state === 'outdated' || newerReleaseAvailable,
      progress: failedAttempt || resumeUpdate ? entry.progress : 1,
      autoResume: resumeUpdate,
      updating: resumeUpdate || (failedAttempt && entry.updating === true),
      usableReleaseTime: release,
      savedAt: release !== entry.usableReleaseTime && entry.usableReleaseTime !== undefined
        ? Date.now() : entry.savedAt ?? Date.now(),
      // Historical SDK errors do not invalidate a completed package. The last
      // failed explicit request remains visible without hiding the old map.
      downloadError: attemptError,
      error: attemptError,
    });
  } else if (native.state === 'downloading' || native.state === 'paused') {
    updateCity(id, {
      ...snapshot,
      status: native.state === 'downloading' ? 'downloading' : native.error || entry.downloadError ? 'error' : 'paused',
      availability: previousReleaseUsable ? 'ready' : 'missing',
      error: native.error ? message(native.error) : undefined,
      downloadError: native.error ? message(native.error) : entry.downloadError,
      updating: entry.updating || (native.state === 'downloading' && previousReleaseUsable),
      autoResume: native.error && native.state === 'paused'
        ? !canDownload() && entry.autoResume
        : native.state === 'downloading' && native.downloadStarted && entry.status === 'ready'
          ? true : entry.autoResume,
    });
  } else if (native.state === 'need_update') {
    updateCity(id, {
      ...snapshot,
      // Keep the old storage vocabulary readable by an older JS bundle.
      status: 'outdated',
      availability: 'invalid',
      needsUpdate: true,
      usableReleaseTime: undefined,
      autoResume: false,
      error: undefined,
    });
  } else if (native.state === 'unsupported') {
    updateCity(id, {
      ...snapshot,
      status: 'error',
      availability: 'invalid',
      autoResume: entry.autoResume,
      error: native.error || 'Офлайн-карта больше не поддерживается. Скачайте её заново.',
    });
  } else if (native.state === 'available') {
    updateCity(id, {
      ...snapshot,
      status: entry.autoResume ? 'paused' : 'available',
      availability: 'missing',
      needsUpdate: false,
      usableReleaseTime: undefined,
      progress: 0,
      savedAt: undefined,
      error: native.error,
    });
  } else {
    throw new Error('Не удалось проверить состояние карты.');
  }
}

export const useOfflineMapStore = create<OfflineMapState>((set, get) => ({
  hydrated: false,
  restorationStatus: 'pending',
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
        let restored = true;
        try {
          const raw = await AsyncStorage.getItem(OFFLINE_CITY_STORAGE_KEY);
          if (raw !== null) {
            const parsed = JSON.parse(raw);
            if (
              parsed.version === 1 &&
              parsed.cities &&
              typeof parsed.cities === 'object' && !Array.isArray(parsed.cities)
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
                ) {
                  // Missing cities are normal; an existing malformed record is not.
                  if (entry !== undefined) restored = false;
                  continue;
                }
                const restoredEntry = {...entry};
                delete restoredEntry.startRequestedAt;
                delete restoredEntry.downloadNotice;
                cities[city.id] = {
                  ...restoredEntry,
                  availability: 'checking',
                  preparing: false,
                  awaitingStart: false,
                  downloadError: typeof entry.downloadError === 'string' ? entry.downloadError : undefined,
                  usableReleaseTime: Number.isFinite(entry.usableReleaseTime) && entry.usableReleaseTime > 0
                    ? entry.usableReleaseTime : undefined,
                  needsUpdate: entry.needsUpdate === true,
                  updating: entry.updating === true,
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
            } else {
              restored = false;
            }
          }
        } catch {
          restored = false;
          set({error: 'Не удалось прочитать сохранённые карты.'});
        }
        set({hydrated: true, restorationStatus: restored ? 'ready' : 'error'});
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
      // This reads the SDK's local catalog; it never requests a network list.
      // It recovers installed regions even if JS metadata was lost.
      let known: NativeRegion[] = [];
      if (typeof YamapInstance.getKnownOfflineRegions === 'function') {
        try { known = JSON.parse(await YamapInstance.getKnownOfflineRegions()) as NativeRegion[]; }
        catch { /* A subsequent poll can retry while the SDK starts. */ }
      }
      for (const city of OFFLINE_MAP_CITIES) {
        try {
          // A queued poll must not cancel a command reserved before its start.
          const pending = get().cities[city.id];
          if (pending?.preparing && !pending.awaitingStart) continue;
          if (!get().cities[city.id]?.regionId) {
            const local = known.find(item => item.name === city.name);
            if (local) updateCity(city.id, {regionId: local.id, sizeBytes: local.sizeBytes});
          }
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
              availability: 'checking',
              error: message(error),
            });
        }
      }
      const downloading = OFFLINE_MAP_CITIES.find(
        city => get().cities[city.id]?.status === 'downloading' || get().cities[city.id]?.preparing,
      );
      set({busyCityId: downloading?.id ?? null});
      await persist();
    }).finally(() => {
      refreshing = null;
    });
    return refreshing;
  },
  download: async (id, refresh = false) => {
    if (
      !getOfflineMapCity(id) ||
      get().busyCityId ||
      get().deletingCityId ||
      !canDownload()
    )
      return;

    // Reserve the single download slot before the first await. Otherwise two
    // quick taps for different cities can both pass the guard while hydrate()
    // yields to the microtask queue.
    set({busyCityId: id, error: ''});
    await get().hydrate();

    if (!canDownload()) {
      if (get().busyCityId === id) set({busyCityId: null});
      return;
    }

    const retrying = get().cities[id]?.status === 'error';
    updateCity(id, {
      preparing: true,
      awaitingStart: false,
      availability: isOfflineCityUsable(get().cities[id]) ? 'ready' : 'missing',
      managed: true,
      autoResume: true,
      error: undefined,
      downloadError: undefined,
      updating: refresh || get().cities[id]?.updating === true,
      ...(refresh ? {progress: 0} : {}),
    });
    await persist();
    await serialize(async () => {
      try {
        if (!(await initYaMap()))
          throw new Error('Карта не инициализировалась. Повторите попытку.');
        const entry = get().cities[id];
        if (!entry?.regionId || entry.nativeState === 'unsupported') {
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
        // Explicit Update always reaches SDK, even for a completed package.
        if (status.state === 'completed' && !refresh && !retrying && !get().cities[id]?.updating) {
          await readStatus(id);
        } else {
          const installedRelease = status.downloadedReleaseTime;
          updateCity(id, {
            awaitingStart: true,
            preparing: true,
            ...((status.state === 'completed' || status.state === 'outdated') && typeof installedRelease === 'number' &&
                Number.isFinite(installedRelease) && installedRelease > 0
              ? {availability: 'ready', usableReleaseTime: installedRelease} : {}),
          });
          await YamapInstance.startOfflineRegionDownload(regionId);
          await readStatus(id);
        }
        if (get().cities[id]?.status !== 'downloading' && !get().cities[id]?.preparing) {
          set({busyCityId: null});
        }
      } catch (error) {
        updateCity(id, {
          status: canDownload() ? 'error' : 'paused',
          preparing: false,
          awaitingStart: false,
          error: canDownload() ? message(error) : undefined,
          downloadError: canDownload() ? message(error) : undefined,
          autoResume: !canDownload(),
        });
        set({busyCityId: null});
      } finally {
        if (!get().cities[id]?.awaitingStart) {
          updateCity(id, {preparing: false});
        }
        await persist();
      }
    });
  },
  pause: async (id, autoResume = false) => {
    const entry = get().cities[id];
    if (!entry) return;
    updateCity(id, {status: 'paused', preparing: false, awaitingStart: false, autoResume, managed: true});
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
          availability: 'missing',
          needsUpdate: false,
          usableReleaseTime: undefined,
          updating: false,
          preparing: false,
          awaitingStart: false,
          downloadError: undefined,
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
            entry?.status === 'downloading' || entry?.preparing ||
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
      return entry?.autoResume && entry.status === 'paused' && entry.availability !== 'checking';
    });
    if (pending) await get().download(pending.id);
  },
}));
