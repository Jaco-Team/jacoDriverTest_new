import AsyncStorage from '@react-native-async-storage/async-storage';
import {waitFor} from '@testing-library/react-native';
import {YamapInstance} from 'react-native-yamap-plus';
import {
  OFFLINE_CITY_STORAGE_KEY,
  useOfflineMapStore,
} from '@/features/offline-map/model/offlineMap.store';
import {useSettingsStore} from '@/shared/store/store';

jest.mock('@/shared/lib/yaMapInit', () => ({
  initYaMap: jest.fn(async () => true),
}));
const native = YamapInstance as jest.Mocked<typeof YamapInstance>;
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const online = {online: true, authenticated: true, active: true};
const statuses: Record<
  number,
  {id: number; state: string; progress: number; error?: string}
> = {};
let disk = new Map<string, string>();

beforeEach(() => {
  jest.clearAllMocks();
  disk = new Map();
  statuses[51] = {id: 51, state: 'available', progress: 0};
  statuses[240] = {id: 240, state: 'available', progress: 0};
  storage.getItem.mockImplementation(async key => disk.get(key) ?? null);
  storage.setItem.mockImplementation(async (key, value) => {
    disk.set(key, value);
  });
  native.getOfflineRegionsAtPoint.mockImplementation(async (_lat, lon) =>
    JSON.stringify(
      lon > 50
        ? [
            {id: 51, name: 'Самара', sizeBytes: 136191760},
            {id: 11131, name: 'Самарская область', sizeBytes: 350241216},
          ]
        : [{id: 240, name: 'Тольятти', sizeBytes: 92083296}],
    ),
  );
  native.getOfflineRegionStatus.mockImplementation(async id =>
    JSON.stringify(statuses[id]),
  );
  native.startOfflineRegionDownload.mockImplementation(async id => {
    statuses[id] = {id, state: 'downloading', progress: 0.25};
  });
  native.pauseOfflineRegionDownload.mockImplementation(async id => {
    statuses[id] = {...statuses[id], state: 'paused'};
  });
  native.removeOfflineRegion.mockImplementation(async id => {
    statuses[id] = {id, state: 'available', progress: 0};
  });
  useOfflineMapStore.setState({
    hydrated: true,
    selectedCityId: '',
    cities: {},
    busyCityId: null,
    deletingCityId: null,
    error: '',
    runtime: online,
  });
});

it('city selection stays local and does not change the cafe filter', async () => {
  useSettingsStore.setState({point_id: 15});
  useOfflineMapStore.getState().selectCity('samara');
  useOfflineMapStore.getState().selectCity('other-city');
  await Promise.resolve();
  expect(useOfflineMapStore.getState().selectedCityId).toBe('samara');
  expect(useSettingsStore.getState().point_id).toBe(15);
  expect(JSON.parse(disk.get(OFFLINE_CITY_STORAGE_KEY)!).selectedCityId).toBe(
    'samara',
  );
});
it('selects the native city package, shows progress, and confirms readiness only after completion', async () => {
  await useOfflineMapStore.getState().download('samara');
  expect(native.startOfflineRegionDownload).toHaveBeenCalledWith(51);
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'downloading',
    progress: 0.25,
    sizeBytes: 136191760,
  });
  statuses[51] = {id: 51, state: 'completed', progress: 1};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'ready',
    progress: 1,
    autoResume: false,
  });
  expect(useOfflineMapStore.getState().busyCityId).toBeNull();
});
it('manual pause persists and does not resume automatically', async () => {
  await useOfflineMapStore.getState().download('samara');
  await useOfflineMapStore.getState().pause('samara');
  await useOfflineMapStore.getState().resumePending();
  expect(native.pauseOfflineRegionDownload).toHaveBeenCalledWith(51);
  expect(native.startOfflineRegionDownload).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(disk.get(OFFLINE_CITY_STORAGE_KEY)!).cities.samara,
  ).toMatchObject({status: 'paused', autoResume: false});
  await useOfflineMapStore.getState().download('samara');
  expect(native.startOfflineRegionDownload).toHaveBeenCalledTimes(2);
});
it('network interruption resumes partial download after reconnect', async () => {
  await useOfflineMapStore.getState().download('samara');
  await useOfflineMapStore.getState().setRuntime({...online, online: false});
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'paused',
    autoResume: true,
  });
  await useOfflineMapStore.getState().setRuntime(online);
  expect(native.startOfflineRegionDownload).toHaveBeenCalledTimes(2);
});
it('cold offline startup preserves pending intent until the session and network recover', async () => {
  disk.set(
    OFFLINE_CITY_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      selectedCityId: 'samara',
      cities: {
        samara: {
          regionId: 51,
          status: 'paused',
          progress: 0.71,
          managed: true,
          autoResume: true,
        },
      },
    }),
  );
  statuses[51] = {id: 51, state: 'paused', progress: 0.71};
  useOfflineMapStore.setState({
    hydrated: false,
    runtime: {online: false, authenticated: false, active: false},
  });
  await useOfflineMapStore.getState().setRuntime({
    online: false,
    authenticated: false,
    active: true,
  });
  expect(native.startOfflineRegionDownload).not.toHaveBeenCalled();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'paused',
    progress: 0.71,
    autoResume: true,
  });
  await useOfflineMapStore.getState().setRuntime({...online, online: false});
  expect(native.startOfflineRegionDownload).not.toHaveBeenCalled();
  await useOfflineMapStore.getState().setRuntime(online);
  expect(native.startOfflineRegionDownload).toHaveBeenCalledWith(51);
});
it('background interruption resumes in the foreground, logout disables automatic resume', async () => {
  await useOfflineMapStore.getState().download('samara');
  await useOfflineMapStore.getState().setRuntime({...online, active: false});
  await useOfflineMapStore.getState().setRuntime(online);
  expect(native.startOfflineRegionDownload).toHaveBeenCalledTimes(2);
  await useOfflineMapStore
    .getState()
    .setRuntime({...online, authenticated: false});
  await useOfflineMapStore.getState().setRuntime(online);
  expect(native.startOfflineRegionDownload).toHaveBeenCalledTimes(2);
});
it('refresh explicitly starts a new download even for an already completed city', async () => {
  useOfflineMapStore.setState({
    cities: {
      samara: {
        regionId: 51,
        status: 'ready',
        progress: 1,
        managed: true,
        autoResume: false,
      },
    },
  });
  statuses[51] = {id: 51, state: 'completed', progress: 1};
  await useOfflineMapStore.getState().download('samara', true);
  expect(native.startOfflineRegionDownload).toHaveBeenCalledWith(51);
  expect(useOfflineMapStore.getState().cities.samara?.status).toBe(
    'downloading',
  );
});
it('deleting a city drops native data and prevents silent automatic redownload', async () => {
  await useOfflineMapStore.getState().download('tolyatti');
  await useOfflineMapStore.getState().pause('tolyatti');
  await useOfflineMapStore.getState().remove('tolyatti');
  expect(native.removeOfflineRegion).toHaveBeenCalledWith(240);
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.tolyatti).toMatchObject({
    status: 'available',
    progress: 0,
    managed: true,
    autoResume: false,
  });
});
it('cold startup restores pending jobs, selected city, and detects deleted native caches', async () => {
  disk.set(
    OFFLINE_CITY_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      selectedCityId: 'samara',
      cities: {
        samara: {
          regionId: 51,
          status: 'downloading',
          progress: 0.5,
          managed: true,
          autoResume: true,
        },
        tolyatti: {
          regionId: 240,
          status: 'ready',
          progress: 1,
          managed: true,
          autoResume: false,
          savedAt: 100,
        },
      },
    }),
  );
  useOfflineMapStore.setState({hydrated: false});
  await useOfflineMapStore.getState().hydrate();
  expect(useOfflineMapStore.getState().selectedCityId).toBe('samara');
  expect(useOfflineMapStore.getState().cities.samara?.status).toBe('paused');
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.tolyatti).toMatchObject({
    status: 'available',
    savedAt: undefined,
  });
});
it('shows native download errors and permits an explicit retry', async () => {
  await useOfflineMapStore.getState().download('samara');
  statuses[51] = {
    id: 51,
    state: 'paused',
    progress: 0.3,
    error: 'Недостаточно свободного места',
  };
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'error',
    autoResume: false,
    error: 'Недостаточно свободного места',
  });
  expect(useOfflineMapStore.getState().busyCityId).toBeNull();
  await useOfflineMapStore.getState().download('samara');
  expect(useOfflineMapStore.getState().cities.samara?.status).toBe(
    'downloading',
  );
});
it('blocks new downloads offline and blocks another city while one is downloading', async () => {
  useOfflineMapStore.setState({runtime: {...online, online: false}});
  await useOfflineMapStore.getState().download('samara');
  expect(native.startOfflineRegionDownload).not.toHaveBeenCalled();
  useOfflineMapStore.setState({runtime: online});
  await useOfflineMapStore.getState().download('samara');
  await useOfflineMapStore.getState().download('tolyatti');
  expect(native.startOfflineRegionDownload).toHaveBeenCalledTimes(1);
});

it('reserves the download slot before async hydration on rapid city taps', async () => {
  useOfflineMapStore.setState({hydrated: false});
  let completeHydration!: (value: string | null) => void;
  storage.getItem.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        completeHydration = resolve;
      }),
  );

  const samaraDownload = useOfflineMapStore.getState().download('samara');
  const tolyattiDownload = useOfflineMapStore.getState().download('tolyatti');

  expect(useOfflineMapStore.getState().busyCityId).toBe('samara');
  expect(useOfflineMapStore.getState().cities.tolyatti).toBeUndefined();

  completeHydration(null);
  await Promise.all([samaraDownload, tolyattiDownload]);

  expect(native.startOfflineRegionDownload).toHaveBeenCalledTimes(1);
  expect(native.startOfflineRegionDownload).toHaveBeenCalledWith(51);
  expect(useOfflineMapStore.getState().cities.tolyatti).toBeUndefined();
});

it('manual pause during catalog preparation never starts the native download', async () => {
  let completeCatalog!: (value: string) => void;
  native.getOfflineRegionsAtPoint.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        completeCatalog = resolve;
      }),
  );
  const starting = useOfflineMapStore.getState().download('samara');
  await waitFor(() =>
    expect(native.getOfflineRegionsAtPoint).toHaveBeenCalled(),
  );
  const pausing = useOfflineMapStore.getState().pause('samara');
  completeCatalog(
    JSON.stringify([{id: 51, name: 'Самара', sizeBytes: 136191760}]),
  );
  await Promise.all([starting, pausing]);
  expect(native.startOfflineRegionDownload).not.toHaveBeenCalled();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'paused',
    autoResume: false,
  });
});
it('network loss while awaiting native status does not start a new download', async () => {
  useOfflineMapStore.setState({
    cities: {
      samara: {
        regionId: 51,
        status: 'available',
        progress: 0,
        managed: true,
        autoResume: false,
      },
    },
  });
  let completeStatus!: (value: string) => void;
  native.getOfflineRegionStatus.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        completeStatus = resolve;
      }),
  );
  const starting = useOfflineMapStore.getState().download('samara');
  await waitFor(() => expect(native.getOfflineRegionStatus).toHaveBeenCalled());
  const losingNetwork = useOfflineMapStore
    .getState()
    .setRuntime({...online, online: false});
  completeStatus(JSON.stringify({id: 51, state: 'available', progress: 0}));
  await Promise.all([starting, losingNetwork]);
  expect(native.startOfflineRegionDownload).not.toHaveBeenCalled();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'paused',
    autoResume: true,
  });
});
it('a transient unsupported status does not leave an old error on an available package', async () => {
  useOfflineMapStore.setState({
    cities: {
      samara: {
        regionId: 51,
        status: 'error',
        progress: 0,
        managed: false,
        autoResume: false,
        error: 'Unsupported during initialization',
      },
    },
  });
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'available',
    error: undefined,
  });
});

it('SDK warmup does not discard auto-resume intent or the saved date of completed maps', async () => {
  useOfflineMapStore.setState({
    cities: {
      samara: {
        regionId: 51,
        status: 'paused',
        progress: 0.4,
        managed: true,
        autoResume: true,
      },
      tolyatti: {
        regionId: 240,
        status: 'ready',
        progress: 1,
        managed: true,
        autoResume: false,
        savedAt: 123,
      },
    },
  });
  statuses[51] = {id: 51, state: 'unsupported', progress: 0};
  statuses[240] = {id: 240, state: 'unsupported', progress: 0};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara?.autoResume).toBe(true);
  statuses[51] = {id: 51, state: 'paused', progress: 0.4};
  statuses[240] = {id: 240, state: 'completed', progress: 1};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.tolyatti?.savedAt).toBe(123);
  await useOfflineMapStore.getState().resumePending();
  expect(native.startOfflineRegionDownload).toHaveBeenCalledWith(51);
});
