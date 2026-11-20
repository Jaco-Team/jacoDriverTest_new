import React from 'react';
import {act, render, waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {CardOrder} from '@/entities/CardOrder/ui/CardOrder';
import {useOrdersStore} from '@/shared/store/ordersStore';
import {useLoginStore} from '@/shared/store/loginStore';
import {useSettingsStore} from '@/shared/store/settingsStore';
import {useGlobalStore} from '@/shared/store/globalStore';
import {pendingFinishes} from '@/shared/store/pendingFinishes';
import {setAppOffline} from '@/shared/lib/connectivityState';
import {DRIVER_OFFLINE_CACHE_STORAGE_KEY} from '@/shared/lib/driverOfflineCache';
import type {Order} from '@/shared/store/OrdersStoreType';
import * as Api from '@/shared/store/api';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => values.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        values.delete(key);
      }),
    },
  };
});

const queueKey = 'jaco_driver_pending_finishes_v1';
const cacheKey = JSON.stringify(['7', 10, 2]);
const otherCacheKey = JSON.stringify(['7', 10, 5]);
const otherPointCacheKey = JSON.stringify(['7', 20, 5]);
const otherOwnerCacheKey = JSON.stringify(['8', 10, 5]);
const unrelatedCacheKey = JSON.stringify(['7', 10, 1]);
const loadOrders = useOrdersStore.getState().getOrders;
const completion = {
  owner: '7',
  pointId: 10,
  orderId: 123,
  completedAt: '2026-11-20T09:16:12.000Z',
  latitude: '53.5',
  longitude: '49.4',
};
const order = {
  id: 123,
  id_text: '#123 В пути',
  status_order: 5,
  is_my: 1,
  is_get: 1,
  is_delete: 0,
  online_pay: 0,
  fake_dom: 1,
  addr: 'Тест',
  comment: '',
  need_time: '13:00 - 13:30',
  sum_order: 100,
  sdacha: 0,
  number: '70000000000',
  count_other: 0,
  count_pizza: 0,
  count_pasta: 0,
  count_drink: 0,
} as Order;
const unrelatedOrders = [{...order, id: 456}];
const props = {
  FormatPrice: String,
  showAlertText: jest.fn(),
  globalFontSize: 16,
  dialCall: jest.fn(),
  actionButtonOrder: jest.fn(),
  setActiveConfirm: jest.fn(),
};

function CurrentOrderCard() {
  const item = useOrdersStore(state => state.orders[0]);
  return item ? <CardOrder item={item} {...props} /> : null;
}

describe('accepted completion while the order list is still loading', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.removeItem(queueKey);
    await pendingFinishes.hydrate();
    setAppOffline(true);
    useLoginStore.setState({
      currentUser: {
        user_id: 7,
        login: 'driver',
        name: null,
        city_id: null,
        point_id: 10,
        appointment_id: null,
      },
    });
    useSettingsStore.setState({point_id: 10});
    useGlobalStore.setState({
      getAuthToken: jest.fn().mockResolvedValue('token'),
      setSpinner: jest.fn(),
      setSpinnerHidden: jest.fn(),
      showModalText: jest.fn(),
    });
    useOrdersStore.setState({
      type: {id: 2, text: 'Мои отмеченные'},
      orders: [order],
      ordersCache: {
        [cacheKey]: [order],
        [otherCacheKey]: [order],
        [otherPointCacheKey]: [order],
        [otherOwnerCacheKey]: [order],
        [unrelatedCacheKey]: unrelatedOrders,
      },
      showOrders: [order],
      ordersContextKey: cacheKey,
      getOrders: jest.fn(loadOrders),
      isClick: false,
      is_check: false,
      is_modalConfirm: false,
      ordersRefreshPending: false,
    });
  });
  afterEach(() => {
    useOrdersStore.setState({getOrders: loadOrders});
    setAppOffline(false);
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the ordinary server error and restores order actions after an explicit refusal', async () => {
    jest
      .spyOn(Api, 'api')
      .mockResolvedValue({st: false, text: 'Заказ еще готовится'});
    await pendingFinishes.put(completion);
    const screen = await render(<CurrentOrderCard />);
    expect(screen.queryByTestId('order-123-finish')).toBeNull();
    setAppOffline(false);
    await act(async () => {
      await pendingFinishes.flush();
    });
    expect(useGlobalStore.getState().showModalText).toHaveBeenCalledWith(
      true,
      'Заказ #123: Заказ еще готовится',
    );
    expect(screen.getByTestId('order-123-finish')).toBeTruthy();
    expect(screen.queryByTestId('order-finish-pending')).toBeNull();
    expect(pendingFinishes.find('7', 10, 123)).toBeUndefined();
    await screen.unmount();
  });

  it.each(['delayed', 'failed', 'stale'])(
    'keeps actions hidden after success with a %s list refresh',
    async refresh => {
      let resolveList!: (response: any) => void;
      const listResponse = new Promise<any>(resolve => {
        resolveList = resolve;
      });
      const api = jest
        .spyOn(Api, 'api')
        .mockImplementation(async (_method, data) => {
          if (data?.type === 'actionOrder') return {st: true, text: ''};
          return listResponse;
        });
      await pendingFinishes.put(completion);
      const screen = await render(<CurrentOrderCard />);
      expect(screen.getByTestId('order-finish-pending')).toHaveTextContent(
        'Завершение сохранено. Ожидает отправки.',
      );

      setAppOffline(false);
      await act(async () => {
        await pendingFinishes.flush();
      });
      await waitFor(() =>
        expect(api).toHaveBeenCalledWith(
          'orders',
          expect.objectContaining({type: 'get_orders'}),
        ),
      );
      expect(screen.getByTestId('order-finish-pending')).toHaveTextContent(
        'Завершение отправлено. Обновляем статус.',
      );
      for (const action of ['finish', 'cancel', 'qr', 'fake']) {
        expect(screen.queryByTestId(`order-123-${action}`)).toBeNull();
      }
      const refreshRequest = jest.mocked(useOrdersStore.getState().getOrders)
        .mock.results[0].value as Promise<void>;
      const spinner = jest.fn();
      // A stale map/confirmation callback must not submit the accepted action again.
      useOrdersStore.getState().setActiveConfirm(true, 123, 'finish');
      expect(useOrdersStore.getState().is_modalConfirm).toBe(false);
      useGlobalStore.setState({setSpinner: spinner});
      useOrdersStore.getState().actionButtonOrder(3, 123);
      expect(spinner).not.toHaveBeenCalled();

      if (refresh === 'failed' || refresh === 'stale') {
        await act(async () => {
          resolveList(
            refresh === 'failed'
              ? {st: false, text: 'Недоступно'}
              : {st: true, text: '', data: {orders: [order]}},
          );
          await refreshRequest;
        });
        expect(pendingFinishes.find('7', 10, 123)?.acknowledged).toBe(true);
        expect(screen.queryByTestId('order-123-finish')).toBeNull();
        await screen.unmount();
        return;
      }
      const finishedOrder = {
        ...order,
        status_order: 6,
        id_text: '#123 У клиента',
        close_date_time_order: '2026-11-20 13:16:12',
      };
      // Switch to the saved other section while the first section's response is still pending.
      await act(async () => {
        setAppOffline(true);
        await useOrdersStore
          .getState()
          .selectType({id: 5, text: 'У других курьеров'});
      });
      await act(async () => {
        resolveList({st: true, text: '', data: {orders: [finishedOrder]}});
        await refreshRequest;
      });
      await waitFor(() =>
        expect(pendingFinishes.find('7', 10, 123)).toBeUndefined(),
      );
      expect(screen.getByTestId('order-card-title')).toHaveTextContent(
        '#123 У клиента',
      );
      expect(screen.getByTestId('order-time-close')).toHaveTextContent(
        'Отдали: 2026-11-20 13:16:12',
      );
      expect(screen.queryByTestId('order-finish-pending')).toBeNull();
      expect(screen.queryByTestId('order-123-finish')).toBeNull();
      const cache = JSON.parse(
        (await AsyncStorage.getItem(DRIVER_OFFLINE_CACHE_STORAGE_KEY))!,
      );
      expect(cache.orders.ordersCache[cacheKey][0].status_order).toBe(6);
      expect(cache.orders.ordersCache[otherCacheKey][0].status_order).toBe(6);
      expect(cache.orders.ordersCache[otherPointCacheKey][0].status_order).toBe(
        5,
      );
      // Persistent snapshots contain only the signed-in courier's data.
      expect(cache.orders.ordersCache[otherOwnerCacheKey]).toBeUndefined();
      expect(
        useOrdersStore.getState().ordersCache[otherOwnerCacheKey][0]
          .status_order,
      ).toBe(5);
      expect(useOrdersStore.getState().ordersCache[unrelatedCacheKey]).toBe(
        unrelatedOrders,
      );
      expect(useOrdersStore.getState().showOrders[0].status_order).toBe(6);
      await act(async () => {
        setAppOffline(true);
        await useOrdersStore
          .getState()
          .selectType({id: 5, text: 'У других курьеров'});
      });
      expect(screen.getByTestId('order-card-title')).toHaveTextContent(
        '#123 У клиента',
      );
      expect(screen.queryByTestId('order-123-finish')).toBeNull();
      expect(
        api.mock.calls.filter(([, data]) => data?.type === 'actionOrder'),
      ).toHaveLength(1);
      await screen.unmount();
    },
  );

  it.each(['foreground', 'background'])(
    'keeps completion when an older %s response arrives after confirmation',
    async requestKind => {
      const finishedOrder = {
        ...order,
        status_order: 6,
        id_text: '#123 У клиента',
        close_date_time_order: '2026-11-20 13:16:12',
      };
      let releaseOldList!: (response: any) => void;
      let notifyStarted!: () => void;
      const oldResponse = new Promise<any>(resolve => {
        releaseOldList = resolve;
      });
      const started = new Promise<void>(resolve => {
        notifyStarted = resolve;
      });
      const api = jest
        .spyOn(Api, 'api')
        .mockImplementation(async (_module, data) => {
          if (data?.type === 'actionOrder') return {st: true, text: ''};
          if (data?.type_orders === 5) {
            notifyStarted();
            return oldResponse;
          }
          return {st: true, text: '', data: {orders: [finishedOrder]}};
        });
      useOrdersStore.setState({
        types: [
          {id: 2, text: 'Мои отмеченные'},
          {id: 5, text: 'У других курьеров'},
        ],
        is_prefetching: false,
        ordersPrefetchPaused: false,
        ordersPrefetchCursor: 0,
      });
      setAppOffline(false);
      let oldRequest: Promise<void>;
      if (requestKind === 'foreground') {
        useOrdersStore.setState({
          type: {id: 5, text: 'У других курьеров'},
          ordersContextKey: otherCacheKey,
        });
        oldRequest = useOrdersStore.getState().getOrders();
      } else {
        oldRequest = useOrdersStore.getState().prefetchOrders();
      }
      await started;
      useOrdersStore.setState({
        type: {id: 2, text: 'Мои отмеченные'},
        ordersContextKey: cacheKey,
      });
      setAppOffline(true);
      await pendingFinishes.put(completion);
      const screen = await render(<CurrentOrderCard />);
      setAppOffline(false);
      await act(async () => {
        await pendingFinishes.flush();
        const requests = jest.mocked(useOrdersStore.getState().getOrders).mock
          .results;
        await (requests[requests.length - 1].value as Promise<void>);
      });
      expect(pendingFinishes.find('7', 10, 123)).toBeUndefined();
      expect(
        useOrdersStore.getState().ordersCache[otherCacheKey][0].status_order,
      ).toBe(6);
      await act(async () => {
        releaseOldList({st: true, text: '', data: {orders: [order]}});
        await oldRequest;
      });
      await act(async () => {
        setAppOffline(true);
        await useOrdersStore
          .getState()
          .selectType({id: 5, text: 'У других курьеров'});
      });
      expect(useOrdersStore.getState().orders[0].status_order).toBe(6);
      expect(screen.getByTestId('order-card-title')).toHaveTextContent(
        '#123 У клиента',
      );
      expect(screen.queryByTestId('order-123-finish')).toBeNull();
      expect(
        useOrdersStore.getState().ordersCache[otherPointCacheKey][0]
          .status_order,
      ).toBe(5);
      expect(
        useOrdersStore.getState().ordersCache[otherOwnerCacheKey][0]
          .status_order,
      ).toBe(5);
      expect(
        api.mock.calls.filter(([, data]) => data?.type === 'actionOrder'),
      ).toHaveLength(1);

      // A new request begun after confirmation still accepts authoritative server changes.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(300);
      });
      api.mockResolvedValue({st: true, text: '', data: {orders: [order]}});
      setAppOffline(false);
      await act(async () => {
        await useOrdersStore.getState().getOrders();
      });
      expect(useOrdersStore.getState().orders[0].status_order).toBe(5);
      await screen.unmount();
    },
  );
});
