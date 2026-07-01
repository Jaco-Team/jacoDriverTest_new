const mockApi = jest.fn();
const mockAnalyticsLog = jest.fn();

jest.mock('@/shared/store/api', () => ({
  api: (...args: any[]) => mockApi(...args),
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: (...args: any[]) => mockAnalyticsLog(...args) },
  AnalyticsEvent: {
    GraphErrCamModalOpen: 'GraphErrCamModalOpen',
    GraphErrCamModalClose: 'GraphErrCamModalClose',
    GraphErrOrderModalOpen: 'GraphErrOrderModalOpen',
    GraphErrOrderModalClose: 'GraphErrOrderModalClose',
    GraphErrOrderAnswerFail: 'GraphErrOrderAnswerFail',
    GraphErrOrderAnswerSuccess: 'GraphErrOrderAnswerSuccess',
  },
}));

import { useGlobalStore, useStatStore } from '@/shared/store/store';

const originalGetGraph = useStatStore.getState().getGraph;
const originalShowModalErrCam = useStatStore.getState().showModalErrCam;
const originalShowModalErrOrder = useStatStore.getState().showModalErrOrder;

describe('useStatStore api flow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    useGlobalStore.setState({
      tokenAuth: 'stat-token',
      loadSpinner: false,
      is_show_modal_text: false,
      modal_text: '',
      avgTime: '',
    });
    useStatStore.setState({
      isClick: false,
      dateGraph: '',
      statPrice: null,
      give_history: [],
      month_list: [],
      dates: [],
      users: [],
      user_name: '',
      err_cam: [],
      err_orders: [],
      statArr: [],
      isShowModalErrCam: false,
      modalErrCam: null,
      isShowModalErrOrder: false,
      modalErrOrder: null,
      getGraph: originalGetGraph,
      showModalErrCam: originalShowModalErrCam,
      showModalErrOrder: originalShowModalErrOrder,
    } as any);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('format helpers: форматирует цену и дату для UI', () => {
    expect(useStatStore.getState().FormatPrice(1234567)).toBe('1 234 567');
    expect(useStatStore.getState().FormatDate('2026-06-30')).toBe('30 июня 2026');
  });

  it('getStatPrice: загружает зарплатную статистику и гасит spinner по таймеру', async () => {
    const stat = { name: 'Driver', my_price: 1500 };
    const giveHist = [{ give: 500, time: '12:00' }];

    mockApi.mockResolvedValueOnce({
      st: true,
      data: {
        stat,
        give_hist: giveHist,
      },
    });

    await useStatStore.getState().getStatPrice('2026-06-30');

    expect(mockApi).toHaveBeenCalledWith('price', {
      type: 'get_my_price',
      token: 'stat-token',
      date: '2026-06-30',
    });
    expect(useStatStore.getState().statPrice).toBe(stat);
    expect(useStatStore.getState().give_history).toBe(giveHist);
    expect(useGlobalStore.getState().loadSpinner).toBe(true);

    jest.advanceTimersByTime(500);

    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('getStatPrice: при st=false не затирает текущие данные и сразу гасит spinner', async () => {
    const stat = { name: 'Old', my_price: 100 };
    useStatStore.setState({ statPrice: stat as any });
    mockApi.mockResolvedValueOnce({ st: false });

    await useStatStore.getState().getStatPrice('2026-06-30');

    expect(useStatStore.getState().statPrice).toBe(stat);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('getGraph: сохраняет календарь, сотрудников и ошибки графика', async () => {
    const month = [{ day: '30', is_active: 1, mounth: '2026-06' }];
    const dates = [{ D: 30, date: '2026-06-30', day: '30', dow: 'Вт' }];
    const users = [[{ user_name: 'Driver', hours: 8 }]];
    const errCam = [{ id: 1, price: 300, imgs: [] }];
    const errOrders = [{ err_id: 2, row_id: 3, imgs: [] }];

    mockApi.mockResolvedValueOnce({
      st: true,
      data: {
        mounth: month,
        all_dates: dates,
        users,
        user_name: 'Driver',
        errs: {
          err_cam: errCam,
          orders: errOrders,
        },
      },
    });

    await useStatStore.getState().getGraph('2026-06');

    expect(mockApi).toHaveBeenCalledWith('graph', {
      type: 'get_my_graph',
      token: 'stat-token',
      date: '2026-06',
    });
    expect(useStatStore.getState().dateGraph).toBe('2026-06');
    expect(useStatStore.getState().month_list).toBe(month);
    expect(useStatStore.getState().dates).toBe(dates);
    expect(useStatStore.getState().users).toBe(users);
    expect(useStatStore.getState().user_name).toBe('Driver');
    expect(useStatStore.getState().err_cam).toBe(errCam);
    expect(useStatStore.getState().err_orders).toBe(errOrders);
  });

  it('answer_err_cam: success закрывает модалку, обновляет график и сбрасывает click/spinner', async () => {
    const mockGetGraph = jest.fn();
    useStatStore.setState({
      isShowModalErrCam: true,
      getGraph: mockGetGraph,
    } as any);
    mockApi.mockResolvedValueOnce({ st: true });

    await useStatStore.getState().answer_err_cam('Комментарий', 11);

    expect(mockApi).toHaveBeenCalledWith('graph', {
      type: 'save_false_cash_cum',
      token: 'stat-token',
      text: 'Комментарий',
      id: 11,
    });
    expect(useStatStore.getState().isShowModalErrCam).toBe(false);
    expect(mockGetGraph).toHaveBeenCalledTimes(1);
    expect(useStatStore.getState().isClick).toBe(true);
    expect(useGlobalStore.getState().loadSpinner).toBe(true);

    jest.advanceTimersByTime(300);

    expect(useStatStore.getState().isClick).toBe(false);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('answer_err_cam: error показывает modal text и не обновляет график', async () => {
    const mockGetGraph = jest.fn();
    useStatStore.setState({ getGraph: mockGetGraph } as any);
    mockApi.mockResolvedValueOnce({ st: false, text: 'Не принято' });

    await useStatStore.getState().answer_err_cam('Комментарий', 11);

    expect(useGlobalStore.getState().is_show_modal_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe('Не принято');
    expect(mockGetGraph).not.toHaveBeenCalled();
  });

  it('answer_err_order: success логирует успех, закрывает модалку и обновляет график', async () => {
    const mockGetGraph = jest.fn();
    useStatStore.setState({
      isShowModalErrOrder: true,
      getGraph: mockGetGraph,
    } as any);
    mockApi.mockResolvedValueOnce({ st: true });

    await useStatStore.getState().answer_err_order('Апелляция', 12, 34);

    expect(mockApi).toHaveBeenCalledWith('graph', {
      type: 'save_false_cash_orders',
      token: 'stat-token',
      text: 'Апелляция',
      err_id: 12,
      row_id: 34,
    });
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'GraphErrOrderAnswerSuccess',
      'Обжалование (график работ): отправлено',
    );
    expect(useStatStore.getState().isShowModalErrOrder).toBe(false);
    expect(mockGetGraph).toHaveBeenCalledTimes(1);
  });

  it('getStatistics: сохраняет среднюю статистику по датам', async () => {
    const avgOrders = [{ driver_id: 1, name: 'Driver', time: 42, time2: '00:42' }];

    mockApi.mockResolvedValueOnce({
      st: true,
      data: {
        avg_orders: avgOrders,
      },
    });

    await useStatStore.getState().getStatistics('2026-06-01', '2026-06-30');

    expect(mockApi).toHaveBeenCalledWith('stat_time', {
      type: 'show_data',
      token: 'stat-token',
      date_start: '2026-06-01',
      date_end: '2026-06-30',
    });
    expect(useStatStore.getState().statArr).toBe(avgOrders);

    jest.advanceTimersByTime(300);

    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('getAvgTime: без token ничего не вызывает, с token сохраняет avg time', async () => {
    useGlobalStore.setState({ tokenAuth: '' });

    await useStatStore.getState().getAvgTime();

    expect(mockApi).not.toHaveBeenCalled();

    useGlobalStore.setState({ tokenAuth: 'stat-token' });
    mockApi.mockResolvedValueOnce({ st: true, text: '31 мин' });

    await useStatStore.getState().getAvgTime();

    expect(mockApi).toHaveBeenCalledWith('orders', {
      type: 'get_my_avg_time',
      token: 'stat-token',
    });
    expect(useGlobalStore.getState().avgTime).toBe('31 мин');
  });
});
