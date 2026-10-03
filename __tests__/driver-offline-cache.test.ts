import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {waitFor} from '@testing-library/react-native';

const mockApi = jest.fn();
const mockFetchLaravelMe = jest.fn();
const mockGetLaravelAuthToken = jest.fn();
const mockClearLaravelAuthToken = jest.fn();
const mockLogoutFromLaravel = jest.fn();

jest.mock('@/shared/store/api', () => ({
  api: (...args: any[]) => mockApi(...args),
}));

jest.mock('@/shared/api/laravel/auth', () => ({
  exchangeLaravelSsoLoginCode: jest.fn(),
  fetchLaravelMe: (...args: any[]) => mockFetchLaravelMe(...args),
  loginWithLaravel: jest.fn(),
  logoutFromLaravel: (...args: any[]) => mockLogoutFromLaravel(...args),
}));

jest.mock('@/shared/lib/laravelAuthTokenStorage', () => ({
  clearLaravelAuthToken: (...args: any[]) => mockClearLaravelAuthToken(...args),
  getLaravelAuthToken: (...args: any[]) => mockGetLaravelAuthToken(...args),
  saveLaravelAuthToken: jest.fn(),
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: {log: jest.fn()},
  AnalyticsEvent: {},
}));

import {
  DRIVER_OFFLINE_CACHE_STORAGE_KEY,
  readDriverOfflineCache,
} from '@/shared/lib/driverOfflineCache';
import {
  useGlobalStore,
  useLoginStore,
  useOrdersStore,
  useSettingsStore,
} from '@/shared/store/store';

const asyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const netInfo = NetInfo as jest.Mocked<typeof NetInfo>;

const order = {
  id: 938188,
  id_text: '#938188',
  status: 'Собран',
  addr: 'улица Баныкина, 52',
  pd: '1',
  xy: {lat: 53.2, lon: 50.1},
};

function offlineCacheFixture() {
  const contextKey = JSON.stringify(['77', 15, 1]);

  return {
    version: 1,
    savedAt: 1_795_000_000_000,
    owner: {login: 'driver', userId: 77},
    phones: {
      phone_center: '+70000000000',
      phone_man: '+71111111111',
      phone_upr: '+72222222222',
    },
    settings: {
      action_centered_map: 1,
      color: '#cc0033',
      fontSize: 18,
      mapScale: 1.4,
      theme: 'black',
      type_data_map: 'full',
      type_show_del: 'min',
      update_interval: 45,
      driver_avg_time: 1,
      driver_page_stat_time: 1,
      night_map: 1,
      is_scaleMap: 1,
      point_id: 15,
      all_points: [{id: 15, name: 'Самара'}],
      points: [{id: 15, name: 'Самара'}],
      rotate_map: true,
    },
    orders: {
      activeTypeId: 1,
      driverNeedGps: true,
      home: {lat: 53.1, lon: 50.2},
      limitCount: '7',
      limitSumm: '5000',
      ordersCache: {[contextKey]: [order]},
      typeDop: ['1', '2', '3'],
      updateInterval: 45,
    },
  };
}

describe('driver offline cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLaravelAuthToken.mockResolvedValue('laravel-token');
    mockClearLaravelAuthToken.mockResolvedValue(undefined);
    mockLogoutFromLaravel.mockResolvedValue(undefined);
    asyncStorage.getItem.mockResolvedValue(null);
    asyncStorage.setItem.mockResolvedValue(undefined);
    asyncStorage.removeItem.mockResolvedValue(undefined);
    netInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: null,
    } as any);

    useGlobalStore.setState({
      tokenAuth: 'laravel-token',
      phones: null,
      globalFontSize: 18,
      theme: 'black',
      mapScale: 1.4,
      is_need_avg_time: true,
      is_need_page_stat: true,
    });
    useLoginStore.setState({
      currentUser: {
        appointment_id: null,
        city_id: null,
        login: 'driver',
        name: 'Курьер',
        point_id: 15,
        user_id: 77,
      },
      is_load: false,
    });
    useSettingsStore.setState({
      action_centered_map: 1,
      color: '#cc0033',
      fontSize: 18,
      mapScale: 1.4,
      theme: 'black',
      type_data_map: 'full',
      type_show_del: 'min',
      update_interval: 45,
      driver_avg_time: true,
      driver_page_stat_time: true,
      night_map: 1,
      is_scaleMap: 1,
      rotate_map: true,
      points: [{id: 15, name: 'Самара'}],
      point_id: 15,
    });
    useOrdersStore.setState({
      type: {id: 1, text: 'Активные'},
      type_dop: ['1', '2', '3'],
      orders: [],
      ordersCache: {},
      ordersContextKey: '',
      is_check: false,
      is_prefetching: false,
      ordersPrefetchPaused: false,
      limit_summ: '',
      limit_count: '',
      home: null,
    });
  });

  it('сохраняет успешную загрузку заказов без auth token в AsyncStorage', async () => {
    useGlobalStore.setState({
      phones: offlineCacheFixture().phones,
    });
    mockApi.mockResolvedValueOnce({
      st: true,
      text: '',
      data: {
        orders: [order],
        limit: '5000',
        limit_count: '7',
        update_interval: 45,
        driver_need_gps: 1,
        home: {lat: 53.1, lon: 50.2},
      },
    });

    await useOrdersStore.getState().getOrders(false);

    await waitFor(() => {
      expect(asyncStorage.setItem).toHaveBeenCalledWith(
        DRIVER_OFFLINE_CACHE_STORAGE_KEY,
        expect.any(String),
      );
    });

    const savedCall = asyncStorage.setItem.mock.calls.find(
      ([key]) => key === DRIVER_OFFLINE_CACHE_STORAGE_KEY,
    );
    const serialized = String(savedCall?.[1] ?? '');
    const saved = JSON.parse(serialized);

    expect(saved.orders.ordersCache[JSON.stringify(['77', 15, 1])]).toEqual([order]);
    expect(saved.settings.point_id).toBe(15);
    expect(saved.phones.phone_center).toBe('+70000000000');
    expect(serialized).not.toContain('laravel-token');
  });

  it('ошибка записи офлайн-кэша не ломает полученный список заказов', async () => {
    asyncStorage.setItem.mockRejectedValueOnce(new Error('Storage is full'));
    mockApi.mockResolvedValueOnce({
      st: true,
      text: '',
      data: {
        orders: [order],
        limit: '5000',
        limit_count: '7',
        update_interval: 45,
        driver_need_gps: 1,
        home: {lat: 53.1, lon: 50.2},
      },
    });

    await expect(useOrdersStore.getState().getOrders(false)).resolves.toBeUndefined();

    await waitFor(() => {
      expect(asyncStorage.setItem).toHaveBeenCalledWith(
        DRIVER_OFFLINE_CACHE_STORAGE_KEY,
        expect.any(String),
      );
    });
    expect(useOrdersStore.getState().orders).toEqual([order]);
  });

  it('игнорирует повреждённый кэш и кэш неизвестной версии', async () => {
    asyncStorage.getItem.mockResolvedValueOnce('{broken-json');
    await expect(readDriverOfflineCache()).resolves.toBeNull();

    asyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
      ...offlineCacheFixture(),
      version: 99,
    }));
    await expect(readDriverOfflineCache()).resolves.toBeNull();
  });

  it('при холодном запуске без сети восстанавливает список, карту, настройки и телефоны', async () => {
    const cache = offlineCacheFixture();
    asyncStorage.getItem.mockImplementation(async key =>
      key === DRIVER_OFFLINE_CACHE_STORAGE_KEY ? JSON.stringify(cache) : '15',
    );
    netInfo.fetch.mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
      details: null,
    } as any);
    useGlobalStore.setState({tokenAuth: '', phones: null});
    useLoginStore.setState({currentUser: null});

    const result = await useLoginStore.getState().check_token();

    expect(result).toBe(true);
    expect(mockFetchLaravelMe).not.toHaveBeenCalled();
    expect(useLoginStore.getState().currentUser?.user_id).toBe(77);
    expect(useSettingsStore.getState().point_id).toBe(15);
    expect(useGlobalStore.getState().phones?.phone_center).toBe('+70000000000');
    expect(useOrdersStore.getState().orders).toEqual([order]);
    expect(useOrdersStore.getState().home).toEqual({lat: 53.1, lon: 50.2});

    useOrdersStore.getState().showOrdersMap(938188);
    expect(useOrdersStore.getState().isOpenOrderMap).toBe(true);
    expect(useOrdersStore.getState().showOrders).toEqual([order]);
  });

  it('восстанавливает кэш, если интерфейс сети активен, но сервер недоступен', async () => {
    const cache = offlineCacheFixture();
    asyncStorage.getItem.mockImplementation(async key =>
      key === DRIVER_OFFLINE_CACHE_STORAGE_KEY ? JSON.stringify(cache) : '15',
    );
    netInfo.fetch.mockResolvedValueOnce({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: null,
    } as any);
    mockFetchLaravelMe.mockRejectedValueOnce({
      code: 'ERR_NETWORK',
      message: 'Network Error',
    });
    useGlobalStore.setState({tokenAuth: '', phones: null});
    useLoginStore.setState({currentUser: null});

    const result = await useLoginStore.getState().check_token();

    expect(result).toBe(true);
    expect(mockFetchLaravelMe).toHaveBeenCalledWith('laravel-token');
    expect(useOrdersStore.getState().orders).toEqual([order]);
    expect(useSettingsStore.getState().point_id).toBe(15);
    expect(useGlobalStore.getState().phones?.phone_man).toBe('+71111111111');
  });

  it('при выходе удаляет офлайн-кэш и очищает заказы', async () => {
    useOrdersStore.setState({orders: [order as any]});

    await useLoginStore.getState().logogout();

    expect(asyncStorage.removeItem).toHaveBeenCalledWith(
      DRIVER_OFFLINE_CACHE_STORAGE_KEY,
    );
    expect(useOrdersStore.getState().orders).toEqual([]);
    expect(useGlobalStore.getState().phones).toBeNull();
  });

  it('не показывает сохранённые заказы другому пользователю', async () => {
    const cache = offlineCacheFixture();
    asyncStorage.getItem.mockImplementation(async key =>
      key === DRIVER_OFFLINE_CACHE_STORAGE_KEY ? JSON.stringify(cache) : null,
    );
    mockFetchLaravelMe.mockResolvedValueOnce({
      appointment_id: null,
      city_id: null,
      login: 'other-driver',
      name: 'Другой курьер',
      point_id: 20,
      user_id: 99,
    });
    mockApi.mockImplementation(async (_module, data) => {
      switch (data.type) {
        case 'getMySetting':
          return {
            st: true,
            text: '',
            data: {
              action_centered_map: 0,
              color: '',
              fontSize: 16,
              mapScale: 1,
              theme: 'white',
              type_data_map: 'norm',
              type_show_del: 'full',
              update_interval: 30,
              driver_avg_time: 1,
              driver_page_stat_time: 0,
              night_map: 0,
              is_scaleMap: 0,
              point_id: 20,
              all_points: [{id: 20, name: 'Тольятти'}],
            },
          };
        case 'get_point_phone':
          return {st: true, text: '', data: {phone: null}};
        case 'get_orders':
          return {st: true, text: '', data: {orders: []}};
        default:
          throw new Error(`Неожиданный запрос в тесте: ${data.type}`);
      }
    });

    const result = await useLoginStore.getState().check_token();

    expect(result).toBe(true);
    expect(useLoginStore.getState().currentUser?.user_id).toBe(99);
    expect(useOrdersStore.getState().orders).toEqual([]);
    expect(asyncStorage.removeItem).toHaveBeenCalledWith(
      DRIVER_OFFLINE_CACHE_STORAGE_KEY,
    );
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        'orders',
        expect.objectContaining({type: 'get_orders', point_id: 20}),
      );
    });
  });
});
