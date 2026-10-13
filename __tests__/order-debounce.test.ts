// __tests__/order-debounce.test.ts
/**
 * Анти-дребезг:
 * - повторные клики не запускают ни GEO, ни api, пока запрос не завершён
 * - после ответа сервера действие снова доступно
 *
 * Важно: первый api() — "подвешенный", чтобы isClick оставался true до второго клика.
 */

import { waitFor } from '@testing-library/react-native';

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: jest.fn() },
  AnalyticsEvent: {},
}));

function deferred<T = any>() {
  let resolve!: (v: T) => void;
  let reject!: (e?: any) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('Анти-дребезг actionButtonOrder', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    try { jest.runOnlyPendingTimers(); } catch {}
    jest.useRealTimers();
  });

  it('повторные клики игнорируются до завершения запроса', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } = require('@/shared/store/store');

    const check_pos_fake = jest.fn((cb: any, payload: any) => cb({ data: payload }));
    useGEOStore.setState({ check_pos_fake });

    useGlobalStore.setState({
      setSpinner: jest.fn(),
      getAuthToken: jest.fn().mockResolvedValue('token'),
      showModalText: jest.fn(),
      notifToken: 'pushToken',
    });

    const d1 = deferred<{ st: boolean; text: string }>();
    const apiSpy = jest
      .spyOn(require('@/shared/store/api'), 'api')
      .mockReturnValueOnce(d1.promise as any)         // 1-й вызов — pending
      .mockResolvedValueOnce({ st: true, text: '' }); // 2-й вызов — success

    useOrdersStore.setState({
      driver_need_gps: false,
      is_modalConfirm: false,
      isOpenOrderMap: false,
      showOrdersMap: jest.fn(),
      getOrders: jest.fn(),
      isClick: false,
    });

    // 1-й клик → api(…) должен быть вызван ПОСЛЕ await getAuthToken()
    useOrdersStore.getState().actionButtonOrder(1, 555);
    await waitFor(() => expect(apiSpy).toHaveBeenCalledTimes(1));
    expect(check_pos_fake).toHaveBeenCalledTimes(1);

    // 2-й клик сразу → игнор (isClick ещё true, т.к. первый api не завершён)
    useOrdersStore.getState().actionButtonOrder(1, 555);
    expect(apiSpy).toHaveBeenCalledTimes(1);
    expect(check_pos_fake).toHaveBeenCalledTimes(1);

    // Даже после старого 300-мс порога запрос ещё выполняется: кнопка должна
    // оставаться заблокированной, а спиннер — видимым.
    jest.advanceTimersByTime(300);

    // 3-й клик во время того же запроса тоже игнорируется.
    useOrdersStore.getState().actionButtonOrder(1, 555);
    expect(apiSpy).toHaveBeenCalledTimes(1);
    expect(check_pos_fake).toHaveBeenCalledTimes(1);

    // После ответа сервера блокировка снимается и новое действие проходит.
    d1.resolve({ st: true, text: '' });
    await waitFor(() => expect(useOrdersStore.getState().isClick).toBe(false));

    useOrdersStore.getState().actionButtonOrder(1, 555);
    await waitFor(() => expect(apiSpy).toHaveBeenCalledTimes(2));
    expect(check_pos_fake).toHaveBeenCalledTimes(2);
  });
});
