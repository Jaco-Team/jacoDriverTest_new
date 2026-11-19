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
  {id: number; state: string; stateKnown?: boolean; progress: number; error?: string; downloadedReleaseTime?: number | null; availableReleaseTime?: number | null; downloadStarted?: boolean}
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
  native.getKnownOfflineRegions.mockResolvedValue('[]');
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
it('explicit Update reaches SDK even for an already completed city', async () => {
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

it('keeps an outdated installed package usable and rejects need_update separately', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'ready', progress: 1, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'outdated', progress: 1, downloadedReleaseTime: 1000};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    availability: 'ready', needsUpdate: true, usableReleaseTime: 1000,
  });
  statuses[51] = {id: 51, state: 'need_update', progress: 1, downloadedReleaseTime: 1000};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    availability: 'invalid', needsUpdate: true,
  });
});

it('a native update error remains visible without hiding a completed installed package', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'error', progress: 1, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'completed', progress: 1, error: 'Old network failure'};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    availability: 'ready', status: 'error', error: 'Old network failure',
  });
});

it('retains the checked previous release across an update, pause and cold offline restart', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'ready', progress: 1, savedAt: 123, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'outdated', progress: 1, downloadedReleaseTime: 1000};
  await useOfflineMapStore.getState().refresh();
  native.startOfflineRegionDownload.mockImplementationOnce(async id => {
    statuses[id] = {id, state: 'downloading', progress: 0.2, downloadedReleaseTime: 1000};
  });
  await useOfflineMapStore.getState().download('samara', true);
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'downloading', availability: 'ready', savedAt: 123,
  });
  await useOfflineMapStore.getState().pause('samara');
  useOfflineMapStore.setState({hydrated: false, cities: {}, runtime: {...online, online: false}});
  await useOfflineMapStore.getState().hydrate();
  expect(useOfflineMapStore.getState().cities.samara?.availability).toBe('checking');
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'paused', availability: 'ready', savedAt: 123, autoResume: false,
  });
});

it('does not advertise a partial first download or a changed installed release as usable', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'paused', progress: 0.4, managed: true, autoResume: false,
    usableReleaseTime: 1000,
  }}});
  for (const downloadedReleaseTime of [null, 2000]) {
    statuses[51] = {id: 51, state: 'paused', progress: 0.4, downloadedReleaseTime};
    await useOfflineMapStore.getState().refresh();
    expect(useOfflineMapStore.getState().cities.samara?.availability).toBe('missing');
  }
});

it('rechecks legacy outdated records instead of treating their date as proof of validity', async () => {
  disk.set(OFFLINE_CITY_STORAGE_KEY, JSON.stringify({version: 1, cities: {samara: {
    regionId: 51, status: 'outdated', progress: 1, savedAt: 123, managed: true, autoResume: false,
  }}}));
  useOfflineMapStore.setState({hydrated: false});
  await useOfflineMapStore.getState().hydrate();
  expect(useOfflineMapStore.getState().cities.samara?.availability).toBe('checking');
  statuses[51] = {id: 51, state: 'need_update', progress: 1};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara?.availability).toBe('invalid');
});

it('recovers an installed city from the local SDK catalog without internet or JS metadata', async () => {
  useOfflineMapStore.setState({runtime: {...online, online: false}});
  native.getKnownOfflineRegions.mockResolvedValueOnce(JSON.stringify([
    {id: 51, name: 'Самара', sizeBytes: 1000},
  ]));
  statuses[51] = {id: 51, state: 'completed', progress: 1, downloadedReleaseTime: 1000};
  await useOfflineMapStore.getState().refresh();
  expect(native.getOfflineRegionsAtPoint).not.toHaveBeenCalled();
  expect(native.startOfflineRegionDownload).not.toHaveBeenCalled();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({regionId: 51, availability: 'ready'});
});

it('a temporary SDK read failure does not erase automatic resume intent', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'paused', progress: 0.4, managed: true, autoResume: true,
  }}});
  native.getOfflineRegionStatus.mockRejectedValueOnce(new Error('SDK is starting'));
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    availability: 'checking', autoResume: true,
  });
});

it('does not release the download slot because of an old error while SDK is downloading', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'downloading', progress: 0.4, managed: true, autoResume: true,
  }}});
  statuses[51] = {id: 51, state: 'downloading', progress: 0.5, error: 'Previous connection loss'};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().busyCityId).toBe('samara');
  expect(useOfflineMapStore.getState().cities.samara?.autoResume).toBe(true);
});

it('updates a known installed region without another network region lookup', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, nativeState: 'completed', status: 'ready', availability: 'ready',
    usableReleaseTime: 1000, progress: 1, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'outdated', progress: 1, downloadedReleaseTime: 1000};
  native.getOfflineRegionsAtPoint.mockRejectedValue(new Error('NetworkErrorBinding'));
  await useOfflineMapStore.getState().download('samara', true);
  expect(native.getOfflineRegionsAtPoint).not.toHaveBeenCalled();
  expect(native.startOfflineRegionDownload).toHaveBeenCalledWith(51);
});

it('keeps a failed update visible across SDK polls and offline restoration without hiding the old map', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'ready', availability: 'ready', usableReleaseTime: 1000,
    progress: 1, savedAt: 123, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'outdated', progress: 1, downloadedReleaseTime: 1000};
  native.startOfflineRegionDownload.mockRejectedValueOnce(
    new Error('com.yandex.runtime.network.internal.NetworkErrorBinding@49d0bb1'),
  );
  await useOfflineMapStore.getState().download('samara', true);
  statuses[51].state = 'completed';
  const expectedError = 'Не удалось связаться с сервером карт Яндекса. Проверьте интернет и повторите.';
  for (let i = 0; i < 3; i++) await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'error', availability: 'ready', downloadError: expectedError, savedAt: 123,
  });
  useOfflineMapStore.setState({hydrated: false, cities: {}, runtime: {...online, online: false}});
  await useOfflineMapStore.getState().hydrate();
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'error', availability: 'ready', downloadError: expectedError,
  });
  useOfflineMapStore.setState({runtime: online});
  await useOfflineMapStore.getState().download('samara');
  expect(useOfflineMapStore.getState().cities.samara?.downloadError).toBeUndefined();
});

it('a verified newly installed release clears the failure of the previous release update', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'error', availability: 'ready', usableReleaseTime: 1000,
    downloadError: 'Previous update failed', progress: 0, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'completed', progress: 1, downloadedReleaseTime: 2000};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'ready', availability: 'ready', usableReleaseTime: 2000, downloadError: undefined,
  });
});


it('an old installed package cannot complete a newly requested update before SDK starts it', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'outdated', availability: 'ready', usableReleaseTime: 1000,
    needsUpdate: true, progress: 1, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'outdated', progress: 1, downloadedReleaseTime: 1000};
  native.startOfflineRegionDownload.mockImplementationOnce(async () => undefined);
  await useOfflineMapStore.getState().download('samara', true);
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    preparing: true, status: 'outdated', availability: 'ready', autoResume: true,
  });
  expect(useOfflineMapStore.getState().busyCityId).toBe('samara');
  statuses[51] = {id: 51, state: 'downloading', progress: 0.1, downloadedReleaseTime: 1000};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    preparing: false, status: 'downloading', autoResume: true,
  });
  statuses[51] = {id: 51, state: 'completed', progress: 1, downloadedReleaseTime: 2000};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'ready', preparing: false, usableReleaseTime: 2000,
  });
});

it('keeps an asynchronous native update failure when the old package remains completed', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'ready', availability: 'ready', usableReleaseTime: 1000,
    progress: 1, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'outdated', progress: 1, downloadedReleaseTime: 1000};
  native.startOfflineRegionDownload.mockImplementationOnce(async () => undefined);
  await useOfflineMapStore.getState().download('samara', true);
  statuses[51].state = 'completed';
  statuses[51].error = 'NetworkErrorBinding';
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'error', availability: 'ready', autoResume: false,
    downloadError: 'Не удалось связаться с сервером карт Яндекса. Проверьте интернет и повторите.',
  });
  delete statuses[51].error;
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara?.status).toBe('error');
  await useOfflineMapStore.getState().download('samara');
  expect(native.startOfflineRegionDownload).toHaveBeenCalledTimes(2);
  expect(useOfflineMapStore.getState().cities.samara?.downloadError).toBeUndefined();
});


it('resumes an update interrupted before SDK leaves the old outdated state', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'outdated', availability: 'ready', usableReleaseTime: 1000,
    needsUpdate: true, progress: 1, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'outdated', progress: 1, downloadedReleaseTime: 1000};
  native.startOfflineRegionDownload.mockImplementationOnce(async () => undefined);
  native.pauseOfflineRegionDownload.mockImplementationOnce(async () => undefined);
  await useOfflineMapStore.getState().download('samara', true);
  await useOfflineMapStore.getState().setRuntime({...online, online: false});
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'paused', availability: 'ready', autoResume: true, preparing: false,
  });
  await useOfflineMapStore.getState().setRuntime(online);
  expect(native.startOfflineRegionDownload).toHaveBeenCalledTimes(2);
  expect(useOfflineMapStore.getState().cities.samara?.status).toBe('downloading');
});


it('does not treat the old completed package as the result of Update while a newer catalog release exists', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'ready', availability: 'ready', usableReleaseTime: 1000,
    progress: 1, savedAt: 123, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'completed', progress: 1,
    downloadedReleaseTime: 1000, availableReleaseTime: 2000, downloadStarted: false};
  native.startOfflineRegionDownload.mockImplementationOnce(async () => undefined);
  await useOfflineMapStore.getState().download('samara', true);
  for (let i = 0; i < 3; i++) await useOfflineMapStore.getState().refresh();
  expect(native.startOfflineRegionDownload).toHaveBeenCalledWith(51);
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    preparing: true, awaitingStart: true, availability: 'ready', autoResume: true, savedAt: 123,
  });
  expect(useOfflineMapStore.getState().busyCityId).toBe('samara');
  statuses[51] = {id: 51, state: 'completed', progress: 1,
    downloadedReleaseTime: 2000, availableReleaseTime: 2000, downloadStarted: true};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'ready', preparing: false, awaitingStart: false, usableReleaseTime: 2000,
  });
  expect(useOfflineMapStore.getState().busyCityId).toBeNull();
});

it('accepts a completed matching catalog release without inventing a download or changing its saved date', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'ready', availability: 'ready', usableReleaseTime: 1000,
    progress: 1, savedAt: 123, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'completed', progress: 1,
    downloadedReleaseTime: 1000, availableReleaseTime: 1000, downloadStarted: false};
  native.startOfflineRegionDownload.mockImplementationOnce(async () => undefined);
  await useOfflineMapStore.getState().download('samara', true);
  expect(native.startOfflineRegionDownload).toHaveBeenCalledWith(51);
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'ready', preparing: false, awaitingStart: false, savedAt: 123, autoResume: false,
  });
  expect(useOfflineMapStore.getState().busyCityId).toBeNull();
});

it('does not guess that a completed old package is current when the catalog release is unknown', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'ready', availability: 'ready', usableReleaseTime: 1000,
    progress: 1, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'completed', progress: 1,
    downloadedReleaseTime: 1000, downloadStarted: false};
  native.startOfflineRegionDownload.mockImplementationOnce(async () => undefined);
  await useOfflineMapStore.getState().download('samara', true);
  expect(useOfflineMapStore.getState().cities.samara?.preparing).toBe(true);
  statuses[51].availableReleaseTime = 1000;
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara?.preparing).toBe(false);
});

it('recognizes a download observed by SDK callbacks even if JS polling misses its downloading state', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'ready', availability: 'ready', usableReleaseTime: 1000,
    progress: 1, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'completed', progress: 1,
    downloadedReleaseTime: 1000, downloadStarted: false};
  native.startOfflineRegionDownload.mockImplementationOnce(async () => undefined);
  await useOfflineMapStore.getState().download('samara', true);
  statuses[51].downloadStarted = true;
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'ready', preparing: false, awaitingStart: false,
  });
});


it('keeps resume intent if SDK starts downloading after an initial completed matching-catalog snapshot', async () => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'ready', availability: 'ready', usableReleaseTime: 1000,
    progress: 1, managed: true, autoResume: false,
  }}});
  statuses[51] = {id: 51, state: 'completed', progress: 1,
    downloadedReleaseTime: 1000, availableReleaseTime: 1000, downloadStarted: false};
  native.startOfflineRegionDownload.mockImplementationOnce(async () => undefined);
  await useOfflineMapStore.getState().download('samara', true);
  statuses[51] = {id: 51, state: 'downloading', progress: 0.2,
    downloadedReleaseTime: 1000, availableReleaseTime: 2000, downloadStarted: true};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    status: 'downloading', availability: 'ready', autoResume: true, updating: true,
  });
});


it('waits for the SDK catalog before invalidating a saved map on cold offline startup', async () => {
  disk.set(OFFLINE_CITY_STORAGE_KEY, JSON.stringify({version: 1, cities: {tolyatti: {
    regionId: 240, status: 'ready', progress: 1, availability: 'ready',
    usableReleaseTime: 1000, savedAt: 123, managed: true, autoResume: false,
  }}}));
  useOfflineMapStore.setState({hydrated: false, cities: {}, runtime: {...online, online: false}});
  await useOfflineMapStore.getState().hydrate();
  statuses[240] = {id: 240, state: 'unsupported', stateKnown: false, progress: 0};
  for (let i = 0; i < 2; i++) await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.tolyatti).toMatchObject({
    availability: 'checking', status: 'ready', progress: 1,
    usableReleaseTime: 1000, savedAt: 123, autoResume: false,
  });
  expect(useOfflineMapStore.getState().cities.tolyatti?.error).toBeUndefined();
  statuses[240] = {id: 240, state: 'completed', stateKnown: true, progress: 1,
    downloadedReleaseTime: 1000, availableReleaseTime: 1000};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.tolyatti).toMatchObject({
    availability: 'ready', status: 'ready', usableReleaseTime: 1000, savedAt: 123,
  });
  expect(native.getOfflineRegionsAtPoint).not.toHaveBeenCalled();
  expect(native.startOfflineRegionDownload).not.toHaveBeenCalled();
});

it('still rejects a region confirmed unsupported by an initialized SDK catalog', async () => {
  useOfflineMapStore.setState({cities: {tolyatti: {
    regionId: 240, status: 'ready', availability: 'checking', progress: 1,
    usableReleaseTime: 1000, savedAt: 123, managed: true, autoResume: false,
  }}});
  statuses[240] = {id: 240, state: 'unsupported', stateKnown: true, progress: 0};
  await useOfflineMapStore.getState().refresh();
  expect(useOfflineMapStore.getState().cities.tolyatti).toMatchObject({
    availability: 'invalid', status: 'error',
  });
  expect(native.startOfflineRegionDownload).not.toHaveBeenCalled();
});

it.each([false, true])('preserves pause intent while SDK state is unknown (autoResume=%s)', async autoResume => {
  useOfflineMapStore.setState({cities: {samara: {
    regionId: 51, status: 'paused', availability: 'checking', progress: 0.47,
    managed: true, autoResume,
  }}});
  statuses[51] = {id: 51, state: 'unsupported', stateKnown: false, progress: 0};
  await useOfflineMapStore.getState().refresh();
  await useOfflineMapStore.getState().resumePending();
  expect(useOfflineMapStore.getState().cities.samara).toMatchObject({
    availability: 'checking', status: 'paused', progress: 0.47, autoResume,
  });
  expect(native.startOfflineRegionDownload).not.toHaveBeenCalled();
  statuses[51] = {id: 51, state: 'paused', stateKnown: true, progress: 0.47};
  await useOfflineMapStore.getState().refresh();
  await useOfflineMapStore.getState().resumePending();
  expect(native.startOfflineRegionDownload).toHaveBeenCalledTimes(autoResume ? 1 : 0);
});
