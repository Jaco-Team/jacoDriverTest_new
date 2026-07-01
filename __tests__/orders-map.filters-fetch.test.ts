const mockApi = jest.fn();

jest.mock('@/shared/store/api', () => ({
  api: (...args: any[]) => mockApi(...args),
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: jest.fn() },
  AnalyticsEvent: {},
}));

import { useGlobalStore, useOrdersStore } from '@/shared/store/store';

const originalGetOrders = useOrdersStore.getState().getOrders;

describe('orders-map filters and getOrders', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useGlobalStore.setState({
      tokenAuth: 'test-token',
      loadSpinner: false,
      loadSpinnerHidden: false,
    });
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
      limit_summ: '',
      limit_count: '',
      update_interval: 30,
      driver_need_gps: true,
      home: null,
      getOrders: originalGetOrders,
    } as any);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('setTypeDop: пустой выбор сбрасывает фильтр на все типы и запускает reload', () => {
    const getOrders = jest.fn();
    useOrdersStore.setState({
      type_dop: ['1'],
      getOrders,
    } as any);

    useOrdersStore.getState().setTypeDop([]);

    expect(useOrdersStore.getState().type_dop).toEqual(['1', '2', '3']);
    expect(getOrders).toHaveBeenCalledWith(true);
  });

  it('filterOrdersByTypes фильтрует активные заказы по статусам доп-типов', () => {
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

  it('getOrders: при st=false сбрасывает loading guard и не затирает текущие заказы', async () => {
    const orders = [{ id: 10, status: 'В очереди' }];
    const setSpinner = jest.fn();
    useGlobalStore.setState({ setSpinner } as any);
    useOrdersStore.setState({
      is_check: false,
      orders,
    } as any);
    mockApi.mockResolvedValueOnce({ st: false, text: 'Ошибка загрузки' });

    await useOrdersStore.getState().getOrders(true);

    expect(mockApi).toHaveBeenCalledTimes(1);
    expect(useOrdersStore.getState().orders).toBe(orders);
    expect(useOrdersStore.getState().is_check).toBe(false);
    expect(setSpinner).toHaveBeenCalledWith(false);
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
