const mockApi = jest.fn();

jest.mock('@/shared/store/api', () => ({
  api: (...args: any[]) => mockApi(...args),
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: jest.fn() },
  AnalyticsEvent: {},
}));

import { useGlobalStore, useOrdersStore, useSettingsStore } from '@/shared/store/store';

const originalGetOrders = useOrdersStore.getState().getOrders;

describe('orders-map filters and getOrders', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useGlobalStore.setState({
      tokenAuth: 'test-token',
      loadSpinner: false,
      loadSpinnerHidden: false,
    });
    useSettingsStore.setState({ point_id: null });
    useOrdersStore.setState({
      is_check: false,
      type: { id: 1, text: 'Активные' },
      types_dop: [
        { id: 1, text: 'В очереди' },
        { id: 2, text: 'Готовится' },
        { id: 3, text: 'Собран' },
      ],
      type_dop: ['1', '2', '3'],
      orders: [],
      ordersCache: {},
      ordersContextKey: '',
      is_prefetching: false,
      ordersPrefetchPaused: false,
      ordersWarmupKey: '',
      ordersPrefetchCursor: 0,
      ordersRefreshPending: false,
      limit_summ: '',
      limit_count: '',
      update_interval: 30,
      driver_need_gps: true,
      home: null,
      getOrders: originalGetOrders,
    } as any);
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('setTypeDop: пустой выбор сбрасывает фильтр на все типы и запускает reload', async () => {
    const getOrders = jest.fn();
    useOrdersStore.setState({
      type_dop: ['1'],
      getOrders,
    } as any);

    useOrdersStore.getState().setTypeDop([]);

    expect(useOrdersStore.getState().type_dop).toEqual(['1', '2', '3']);
    expect(getOrders).toHaveBeenCalledWith(true);
  });

  it('filterOrdersByTypes фильтрует активные заказы по статусам доп-типов', async () => {
    const result = useOrdersStore.getState().filterOrdersByTypes(
      [
        { id: 1, status: 'В очереди' },
        { id: 2, status: 'Готовится' },
        { id: 3, status: 'Собран' },
        { id: 4, status: 'Отдан' },
      ] as any[],
      ['1', '3'],
    );

    expect(result.map((order: any) => order.id)).toEqual([1, 3]);
  });

  it('getOrders: для активных заказов применяет type_dop-фильтр и обновляет limit/home/settings', async () => {
    useOrdersStore.setState({
      type: { id: 1, text: 'Активные' },
      type_dop: ['1', '3'],
    } as any);

    mockApi.mockResolvedValueOnce({
      st: true,
      text: '',
      data: {
        orders: [
          { id: 1, status: 'В очереди' },
          { id: 2, status: 'Готовится' },
          { id: 3, status: 'Собран' },
        ],
        limit: '5000',
        limit_count: '7',
        update_interval: 0,
        driver_need_gps: 0,
        home: { lon: 53.2, lat: 53.1 },
      },
    });

    await useOrdersStore.getState().getOrders(true);

    expect(mockApi).toHaveBeenCalledWith('orders', {
      type: 'get_orders',
      type_orders: 1,
      token: 'test-token',
    });
    expect(useOrdersStore.getState().orders.map((order: any) => order.id)).toEqual([1, 3]);
    expect(useOrdersStore.getState().limit_summ).toBe('5000');
    expect(useOrdersStore.getState().limit_count).toBe('7');
    expect(useOrdersStore.getState().update_interval).toBe(0);
    expect(useOrdersStore.getState().driver_need_gps).toBe(false);
    expect(useOrdersStore.getState().home).toEqual({ lon: 53.2, lat: 53.1 });
  });

  it('getOrders: не создаёт новый объект home, если точка с сервера не изменилась', async () => {
    const home = { lon: 53.2, lat: 53.1 };
    useOrdersStore.setState({
      home,
      type: { id: 1, text: 'Активные' },
      type_dop: ['1', '2', '3'],
    } as any);

    mockApi.mockResolvedValueOnce({
      st: true,
      text: '',
      data: {
        orders: [{ id: 1, status: 'В очереди' }],
        limit: '5000',
        limit_count: '7',
        update_interval: 30,
        driver_need_gps: 0,
        home: { lon: 53.2, lat: 53.1 },
      },
    });

    await useOrdersStore.getState().getOrders(true);

    expect(useOrdersStore.getState().home).toBe(home);
  });

  it('getOrders: без auth token не делает API-запрос', async () => {
    useGlobalStore.setState({ tokenAuth: '' });

    await useOrdersStore.getState().getOrders(true);

    expect(mockApi).not.toHaveBeenCalled();
  });

  it('getOrders: пока предыдущая загрузка активна, повторный запрос игнорируется', async () => {
    useOrdersStore.setState({ is_check: true } as any);

    await useOrdersStore.getState().getOrders(true);

    expect(mockApi).not.toHaveBeenCalled();
  });

  it('getOrders: без сети сохраняет заказы и позволяет открыть их с карты', async () => {
    const orders = [{
      id: 10,
      status: 'В очереди',
      addr: 'ул. Ленина, 1',
      pd: '2',
      xy: { lat: 53.2, lon: 50.1 },
    }];
    const home = { lat: 53.1, lon: 50.2 };
    const setSpinner = jest.fn();
    const setSpinnerHidden = jest.fn();
    useGlobalStore.setState({ setSpinner, setSpinnerHidden } as any);
    useOrdersStore.setState({
      is_check: false,
      showOrders: [],
      isOpenOrderMap: false,
    } as any);
    mockApi
      .mockResolvedValueOnce({
        st: true,
        text: '',
        data: {
          orders,
          limit: '5000',
          limit_count: '7',
          update_interval: 30,
          driver_need_gps: 1,
          home,
        },
      })
      .mockResolvedValueOnce({ st: false, text: 'Не удалось подключиться к серверу.' });

    await useOrdersStore.getState().getOrders(false);
    jest.advanceTimersByTime(300);

    await useOrdersStore.getState().getOrders(false);

    expect(mockApi).toHaveBeenCalledTimes(2);
    expect(useOrdersStore.getState().orders).toBe(orders);
    expect(useOrdersStore.getState().home).toBe(home);
    expect(useOrdersStore.getState().limit_summ).toBe('5000');
    expect(useOrdersStore.getState().limit_count).toBe('7');
    expect(useOrdersStore.getState().is_check).toBe(false);
    expect(setSpinner).toHaveBeenCalledWith(false);
    expect(setSpinnerHidden).toHaveBeenNthCalledWith(1, true);
    expect(setSpinnerHidden).toHaveBeenLastCalledWith(false);

    useOrdersStore.getState().showOrdersMap(10);

    expect(mockApi).toHaveBeenCalledTimes(2);
    expect(useOrdersStore.getState().isOpenOrderMap).toBe(true);
    expect(useOrdersStore.getState().showOrders).toEqual(orders);
  });

  it('getOrders: офлайн не смешивает заказы разных разделов', async () => {
    const activeType = { id: 1, text: 'Активные' };
    const otherType = { id: 5, text: 'У других курьеров' };
    const preorderType = { id: 3, text: 'Предзаказы' };
    const activeOrders = [{ id: 10, status: 'В очереди' }];
    const otherOrders = [{ id: 50, status: 'Готовится' }];
    const successResponse = (orders: typeof activeOrders) => ({
      st: true,
      text: '',
      data: {
        orders,
        limit: '5000',
        limit_count: '7',
        update_interval: 30,
        driver_need_gps: 1,
        home: { lat: 53.1, lon: 50.2 },
      },
    });

    mockApi.mockResolvedValueOnce(successResponse(activeOrders));
    await useOrdersStore.getState().getOrders(false);
    jest.advanceTimersByTime(300);

    mockApi.mockResolvedValueOnce(successResponse(otherOrders));
    await useOrdersStore.getState().selectType(otherType);
    jest.advanceTimersByTime(300);

    mockApi.mockResolvedValueOnce({ st: false, text: 'Нет сети' });
    await useOrdersStore.getState().selectType(activeType);
    expect(useOrdersStore.getState().orders).toBe(activeOrders);

    mockApi.mockResolvedValueOnce({ st: false, text: 'Нет сети' });
    await useOrdersStore.getState().selectType(otherType);
    expect(useOrdersStore.getState().orders).toBe(otherOrders);

    mockApi.mockResolvedValueOnce({ st: false, text: 'Нет сети' });
    await useOrdersStore.getState().selectType(preorderType);
    expect(useOrdersStore.getState().orders).toEqual([]);
    expect(mockApi).toHaveBeenCalledTimes(5);
  });

  it('getOrders: офлайн не смешивает заказы разных кафе', async () => {
    const firstPointOrders = [{ id: 10, status: 'В очереди' }];
    const secondPointOrders = [{ id: 20, status: 'Готовится' }];
    const successResponse = (orders: typeof firstPointOrders) => ({
      st: true,
      text: '',
      data: {
        orders,
        limit: '5000',
        limit_count: '7',
        update_interval: 30,
        driver_need_gps: 1,
        home: { lat: 53.1, lon: 50.2 },
      },
    });

    useSettingsStore.setState({ point_id: 1 });
    mockApi.mockResolvedValueOnce(successResponse(firstPointOrders));
    await useOrdersStore.getState().getOrders(false);
    jest.advanceTimersByTime(300);

    useSettingsStore.setState({ point_id: 2 });
    mockApi.mockResolvedValueOnce(successResponse(secondPointOrders));
    await useOrdersStore.getState().getOrders(false);
    jest.advanceTimersByTime(300);

    useSettingsStore.setState({ point_id: 1 });
    mockApi.mockResolvedValueOnce({ st: false, text: 'Нет сети' });
    await useOrdersStore.getState().getOrders(false);
    expect(useOrdersStore.getState().orders).toBe(firstPointOrders);

    useSettingsStore.setState({ point_id: 2 });
    mockApi.mockResolvedValueOnce({ st: false, text: 'Нет сети' });
    await useOrdersStore.getState().getOrders(false);
    expect(useOrdersStore.getState().orders).toBe(secondPointOrders);
    expect(mockApi).toHaveBeenCalledTimes(4);
  });

  it('prefetchOrders: при первом прогреве последовательно кэширует все закрытые разделы', async () => {
    const activeOrders = [{ id: 10, status: 'В очереди' }];
    useOrdersStore.setState({ orders: activeOrders } as any);
    mockApi.mockImplementation(async (_module: string, data: { type_orders: number }) => ({
      st: true,
      text: '',
      data: {
        orders: [{ id: data.type_orders * 10, status: 'Готовится' }],
      },
    }));

    await useOrdersStore.getState().prefetchOrders(true);

    expect(mockApi.mock.calls.map(([, data]) => data.type_orders)).toEqual([3, 2, 5, 6]);
    expect(useOrdersStore.getState().orders).toBe(activeOrders);
    expect(
      Object.values(useOrdersStore.getState().ordersCache)
        .flat()
        .map(order => order.id),
    ).toEqual([30, 20, 50, 60]);
    expect(useOrdersStore.getState().ordersWarmupKey).not.toBe('');
    expect(useOrdersStore.getState().is_prefetching).toBe(false);
  });

  it('prefetchOrders: после прогрева обновляет по одному закрытому разделу за тик', async () => {
    mockApi.mockImplementation(async (_module: string, data: { type_orders: number }) => ({
      st: true,
      text: '',
      data: { orders: [{ id: data.type_orders }] },
    }));

    await useOrdersStore.getState().prefetchOrders(false);
    await useOrdersStore.getState().prefetchOrders(false);

    expect(mockApi.mock.calls.map(([, data]) => data.type_orders)).toEqual([3, 2]);
    expect(useOrdersStore.getState().ordersPrefetchCursor).toBe(2);
  });

  it('prefetchOrders: после сетевой ошибки приостанавливает фоновые запросы', async () => {
    mockApi.mockResolvedValueOnce({ st: false, text: 'Нет сети' });

    await useOrdersStore.getState().prefetchOrders(false);
    await useOrdersStore.getState().prefetchOrders(false);

    expect(mockApi).toHaveBeenCalledTimes(1);
    expect(useOrdersStore.getState().ordersPrefetchPaused).toBe(true);
    expect(useOrdersStore.getState().is_prefetching).toBe(false);
  });

  it('prefetchOrders: не запускает обычное обновление параллельно фоновому', async () => {
    let finishBackground!: (value: any) => void;
    let markForegroundStarted!: () => void;
    const backgroundResponse = new Promise(resolve => {
      finishBackground = resolve;
    });
    const foregroundStarted = new Promise<void>(resolve => {
      markForegroundStarted = resolve;
    });

    mockApi
      .mockImplementationOnce(() => backgroundResponse)
      .mockImplementationOnce(async () => {
        markForegroundStarted();
        return {
          st: true,
          text: '',
          data: { orders: [{ id: 10, status: 'В очереди' }] },
        };
      });

    const background = useOrdersStore.getState().prefetchOrders(false);
    while (!useOrdersStore.getState().is_prefetching) {
      await Promise.resolve();
    }

    await useOrdersStore.getState().getOrders(false);

    expect(mockApi).toHaveBeenCalledTimes(1);
    expect(useOrdersStore.getState().ordersRefreshPending).toBe(true);

    finishBackground({
      st: true,
      text: '',
      data: { orders: [{ id: 30, status: 'Готовится' }] },
    });
    await background;
    await foregroundStarted;

    expect(mockApi).toHaveBeenCalledTimes(2);
    expect(mockApi.mock.calls[1][1].type_orders).toBe(1);
    expect(useOrdersStore.getState().ordersRefreshPending).toBe(false);
  });

  it('getOrders: повторяет цикл онлайн — офлайн — онлайн — офлайн без потери последних заказов', async () => {
    const firstOrders = [{ id: 10, status: 'В очереди' }];
    const refreshedOrders = [{ id: 20, status: 'Готовится' }];
    const setSpinnerHidden = jest.fn();
    useGlobalStore.setState({ setSpinnerHidden } as any);
    mockApi
      .mockResolvedValueOnce({
        st: true,
        text: '',
        data: {
          orders: firstOrders,
          limit: '5000',
          limit_count: '7',
          update_interval: 30,
          driver_need_gps: 1,
          home: { lat: 53.1, lon: 50.2 },
        },
      })
      .mockResolvedValueOnce({ st: false, text: 'Не удалось подключиться к серверу.' })
      .mockResolvedValueOnce({
        st: true,
        text: '',
        data: {
          orders: refreshedOrders,
          limit: '6000',
          limit_count: '8',
          update_interval: 30,
          driver_need_gps: 1,
          home: { lat: 53.1, lon: 50.2 },
        },
      })
      .mockResolvedValueOnce({ st: false, text: 'Не удалось подключиться к серверу.' });

    await useOrdersStore.getState().getOrders(false);
    jest.advanceTimersByTime(300);
    expect(useOrdersStore.getState().orders).toBe(firstOrders);
    expect(useOrdersStore.getState().is_check).toBe(false);

    await useOrdersStore.getState().getOrders(false);
    expect(useOrdersStore.getState().orders).toBe(firstOrders);
    expect(useOrdersStore.getState().is_check).toBe(false);

    await useOrdersStore.getState().getOrders(false);
    jest.advanceTimersByTime(300);
    expect(useOrdersStore.getState().orders).toBe(refreshedOrders);
    expect(useOrdersStore.getState().limit_summ).toBe('6000');
    expect(useOrdersStore.getState().limit_count).toBe('8');
    expect(useOrdersStore.getState().is_check).toBe(false);

    await useOrdersStore.getState().getOrders(false);
    expect(mockApi).toHaveBeenCalledTimes(4);
    expect(useOrdersStore.getState().orders).toBe(refreshedOrders);
    expect(useOrdersStore.getState().limit_summ).toBe('6000');
    expect(useOrdersStore.getState().limit_count).toBe('8');
    expect(useOrdersStore.getState().is_check).toBe(false);
    expect(setSpinnerHidden).toHaveBeenLastCalledWith(false);
  });

  it('getOrders: при пустом data.orders показывает ошибку и гасит спиннеры по таймеру', async () => {
    const showModalText = jest.fn();
    const setSpinner = jest.fn();
    const setSpinnerHidden = jest.fn();
    useGlobalStore.setState({
      showModalText,
      setSpinner,
      setSpinnerHidden,
    } as any);
    mockApi.mockResolvedValueOnce({ st: true, text: 'Заказы не найдены', data: {} });

    await useOrdersStore.getState().getOrders(false);

    expect(showModalText).toHaveBeenCalledWith(true, 'Заказы не найдены');
    expect(useOrdersStore.getState().is_check).toBe(true);

    jest.advanceTimersByTime(300);

    expect(useOrdersStore.getState().is_check).toBe(false);
    expect(setSpinner).toHaveBeenCalledWith(false);
    expect(setSpinnerHidden).toHaveBeenCalledWith(false);
  });
});
