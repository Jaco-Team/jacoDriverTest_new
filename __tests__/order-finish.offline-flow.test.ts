import AsyncStorage from '@react-native-async-storage/async-storage';
import {useOrdersStore, useGEOStore, useGlobalStore} from '@/shared/store/store';
import {useLoginStore} from '@/shared/store/loginStore';
import {useSettingsStore} from '@/shared/store/settingsStore';
import {setAppOffline} from '@/shared/lib/connectivityState';
import * as Api from '@/shared/store/api';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => values.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {values.set(key, value);}),
      removeItem: jest.fn(async (key: string) => {values.delete(key);}),
    },
  };
});

const key = 'jaco_driver_pending_finishes_v1';
describe('offline finish through the mobile action and GPS callback', () => {
  let callback!: (payload: any) => Promise<void>;
  let payload: any;
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-20T10:00:00.000Z').getTime());
    await AsyncStorage.removeItem(key);
    setAppOffline(true);
    useLoginStore.setState({currentUser: {user_id: 7, login: 'driver', name: null, city_id: null, point_id: 10, appointment_id: null}});
    useSettingsStore.setState({point_id: 10});
    useGlobalStore.setState({setSpinner: jest.fn(), showModalText: jest.fn()});
    useOrdersStore.setState({isClick: false, isOpenOrderMap: false, driver_need_gps: true, is_modalConfirm: true, type_confirm: 'finish'});
    useGEOStore.setState({check_pos: jest.fn((fn, data) => {callback = fn; payload = data;})});
    jest.spyOn(Api, 'api').mockResolvedValue({st: true, text: ''});
  });
  afterEach(() => {
    setAppOffline(false);
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it('keeps the confirmation time rather than the later GPS time and sends nothing offline', async () => {
    useOrdersStore.getState().actionButtonOrder(3, 123);
    jest.setSystemTime(new Date('2026-11-20T10:00:25.000Z').getTime());
    await callback({data: payload, latitude: '53.5', longitude: '49.4'});
    expect(JSON.parse((await AsyncStorage.getItem(key))!)).toEqual([
      {owner: '7', pointId: 10, orderId: 123, completedAt: '2026-11-20T10:00:00.000Z', latitude: '53.5', longitude: '49.4'},
    ]);
    expect(Api.api).not.toHaveBeenCalled();
    expect(useOrdersStore.getState().isClick).toBe(false);
    expect(useOrdersStore.getState().is_modalConfirm).toBe(false);
  });
  it('does not claim success when writing to storage fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    useOrdersStore.getState().actionButtonOrder(3, 123);
    await callback({data: payload, latitude: '53.5', longitude: '49.4'});
    expect(await AsyncStorage.getItem(key)).toBeNull();
    expect(useGlobalStore.getState().showModalText).toHaveBeenCalledWith(true, 'disk full');
    expect(useOrdersStore.getState().is_modalConfirm).toBe(true);
    expect(Api.api).not.toHaveBeenCalled();
  });
  it('discards a GPS callback for the previous account', async () => {
    useOrdersStore.getState().actionButtonOrder(3, 123);
    useLoginStore.setState({currentUser: {user_id: 8, login: 'other', name: null, city_id: null, point_id: 10, appointment_id: null}});
    await callback({data: payload, latitude: '53.5', longitude: '49.4'});
    expect(await AsyncStorage.getItem(key)).toBeNull();
    expect(Api.api).not.toHaveBeenCalled();
  });
});
