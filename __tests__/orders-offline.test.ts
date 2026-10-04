const mockApi = jest.fn();
jest.mock('@/shared/store/api', () => ({ api: (...args: any[]) => mockApi(...args) }));
jest.mock('@/analytics/AppMetricaService', () => ({ Analytics: { log: jest.fn() }, AnalyticsEvent: {} }));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGlobalStore, useOrdersStore, useLoginStore } from '@/shared/store/store';

const getOrders = useOrdersStore.getState().getOrders;
const payload = { orders: [{ id: 1, status: 'В очереди' }, { id: 2, status: 'Готовится' }], limit: '500', limit_count: '2', update_interval: 30, driver_need_gps: 0 };
let disk: Record<string, string>;

describe('offline orders', () => {
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockApi.mockReset();
  disk = {};
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async key => disk[key] ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => { disk[key] = value; });
  useGlobalStore.setState({ tokenAuth: 'account-a' });
  useOrdersStore.setState({ getOrders, orders: [], is_check: false, type: { id: 1, text: 'Активные' }, type_dop: ['1', '2', '3'], activeOrdersSavedAt: null, showingSavedOrders: false });
});
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });
async function fetchOnline(data = payload) {
  mockApi.mockResolvedValueOnce({ st: true, data });
  await getOrders();
  jest.advanceTimersByTime(300);
}

it('persists the unfiltered list and restores after memory is lost, before network completes', async () => {
  useOrdersStore.setState({ type_dop: ['1'] });
  await fetchOnline();
  expect(useOrdersStore.getState().orders).toHaveLength(1);
  useOrdersStore.setState({ orders: [], type_dop: ['1', '2', '3'] });
  let resolve!: (value: any) => void;
  mockApi.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const request = getOrders();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(useOrdersStore.getState().orders).toEqual(payload.orders);
  expect(useOrdersStore.getState().showingSavedOrders).toBe(true);
  resolve({ st: false, networkError: true });
  await request;
  expect(useOrdersStore.getState().orders).toEqual(payload.orders);
});

it('replaces stale cache with a successful empty list', async () => {
  await fetchOnline();
  await fetchOnline({ ...payload, orders: [] });
  useOrdersStore.setState({ orders: [] });
  mockApi.mockResolvedValueOnce({ st: false });
  await getOrders();
  expect(useOrdersStore.getState().orders).toEqual([]);
  expect(useOrdersStore.getState().activeOrdersSavedAt).not.toBeNull();
});

it('does not restore another account’s data', async () => {
  await fetchOnline();
  await useGlobalStore.getState().setTokenAuth('account-b');
  mockApi.mockResolvedValueOnce({ st: false });
  await getOrders();
  expect(useOrdersStore.getState().orders).toEqual([]);
});

it('allows saved-account startup only on transport failure, never server rejection', async () => {
  await fetchOnline();
  mockApi.mockResolvedValueOnce({ st: false, networkError: true });
  expect(await useLoginStore.getState().check_token()).toBe(true);
  mockApi.mockResolvedValueOnce({ st: false, text: 'Invalid token' });
  expect(await useLoginStore.getState().check_token()).toBe(false);
});

it('corrupt storage does not prevent an online fetch', async () => {
  disk['active-orders-v1'] = '{broken';
  await fetchOnline();
  expect(useOrdersStore.getState().orders).toEqual(payload.orders);
});

it('storage failure does not discard a successful response', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  await fetchOnline();
  expect(useOrdersStore.getState().orders).toEqual(payload.orders);
  expect(useOrdersStore.getState().activeOrdersSavedAt).toBeNull();
});

it('restores token on cold startup and never uses active cache for another category', async () => {
  await fetchOnline();
  disk.token = 'account-a';
  useGlobalStore.setState({ tokenAuth: '' });
  useOrdersStore.setState({ orders: [] });
  mockApi.mockResolvedValueOnce({ st: false, networkError: true });
  expect(await useLoginStore.getState().check_token()).toBe(true);
  useOrdersStore.setState({ type: { id: 6, text: 'Мои завершенные' } });
  mockApi.mockResolvedValueOnce({ st: false });
  await getOrders();
  expect(useOrdersStore.getState().orders).toEqual([]);
});

});
