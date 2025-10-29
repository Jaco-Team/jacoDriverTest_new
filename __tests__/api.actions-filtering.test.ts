// __tests__/api.actions-filtering.test.ts
/**
 * ТЕСТ: режим 'actions' — локальное скрытие заказов.
 * 1) actionOrder/checkFakeOrder -> ничего не уходит в бэк, id попадает в __FAKE_HIDDEN_IDS__.
 * 2) Следующий реальный get_orders приходит с этими id, но api.ts их фильтрует из orders/free_orders/... .
 *
 * Важно: axios.post берём ВНУТРИ isolate, через default-экспорт,
 * чтобы не было расхождения инстансов моков.
 */

import 'jest';
jest.mock('axios'); // мок целого модуля

describe('api.ts: режим actions — фильтрация скрытых id из списков', () => {
  const realEnv = process.env.NODE_ENV;
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.resetModules();
    // не трогаем axios.post тут — внутри isolate получим правильный инстанс
    (global as any).__FAKE_ORDERS__ = undefined;
    (global as any).__FAKE_HIDDEN_IDS__ = undefined;
  });

  afterAll(() => {
    process.env.NODE_ENV = realEnv;
    logSpy.mockRestore();
  });

  async function runIsolated<T>(setup: () => Promise<T> | T) {
    let result: any;
    await jest.isolateModulesAsync(async () => {
      try { /* @ts-ignore */ delete (global as any).__DEV__; } catch {}
      result = await setup();
    });
    return result;
  }

  it('после actionOrder id скрывается и фильтруется из последующих списков', async () => {
    await runIsolated(async () => {
      process.env.NODE_ENV = 'development';
      (global as any).__FAKE_ORDERS__ = 'actions';

      const { api } = require('@/shared/store/api');

      // 1) Нажали "Взять" — перехват, axios.post не вызывается
      await api('orders', { type: 'actionOrder', id: 7, type_action: 1 });

      const hidden = (global as any).__FAKE_HIDDEN_IDS__ as Set<string>;
      expect(hidden).toBeDefined();
      expect([...hidden]).toContain('7');

      // 2) Реальный get_orders — мок через axios.default.post внутри isolate
      type AxiosDefault = typeof import('axios')['default'];
      const axiosInIso = (require('axios') as { default: jest.Mocked<AxiosDefault> }).default;
      const postInIso = axiosInIso.post as jest.Mock;

      postInIso.mockResolvedValueOnce({
        data: {
          st: true,
          text: '',
          orders:       [{ id: '7' }, { id: '8' }],
          free_orders:  [{ id: '7' }],
          my_orders:    [{ id: '9' }],
          other_orders: [{ id: '7' }, { id: '10' }],
          pred_orders:  [{ id: '7' }],
        },
      });

      const res = await api('orders', { type: 'get_orders' });
      expect(postInIso).toHaveBeenCalledTimes(1);

      const payload = res.data as any;
      const ids = (arr?: any[]) => (Array.isArray(arr) ? arr.map(x => String(x.id)) : []);

      expect(ids(payload.orders)).toEqual(['8']);
      expect(ids(payload.free_orders)).toEqual([]);
      expect(ids(payload.my_orders)).toEqual(['9']);
      expect(ids(payload.other_orders)).toEqual(['10']);
      expect(ids(payload.pred_orders)).toEqual([]);
    });
  });

  it('checkFakeOrder добавляет в скрытые и фильтрация срабатывает', async () => {
    await runIsolated(async () => {
      process.env.NODE_ENV = 'development';
      (global as any).__FAKE_ORDERS__ = 'actions';

      const { api } = require('@/shared/store/api');

      // 1) Fake-кейс — перехват, без axios.post
      await api('orders', { type: 'checkFakeOrder', order_id: 42 });

      const hidden = (global as any).__FAKE_HIDDEN_IDS__ as Set<string>;
      expect([...hidden]).toContain('42');

      // 2) get_orders — мок через axios.default.post
      type AxiosDefault = typeof import('axios')['default'];
      const axiosInIso = (require('axios') as { default: jest.Mocked<AxiosDefault> }).default;
      const postInIso = axiosInIso.post as jest.Mock;

      postInIso.mockResolvedValueOnce({
        data: {
          st: true,
          text: '',
          orders:      [{ id: '41' }, { id: '42' }],
          free_orders: [{ id: '42' }],
        },
      });

      const res = await api('orders', { type: 'get_orders' });
      expect(postInIso).toHaveBeenCalledTimes(1);

      const payload = res.data as any;
      const ids = (arr?: any[]) => (Array.isArray(arr) ? arr.map(x => String(x.id)) : []);
      expect(ids(payload.orders)).toEqual(['41']);
      expect(ids(payload.free_orders)).toEqual([]);
    });
  });
});
