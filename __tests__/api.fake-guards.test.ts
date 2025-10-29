// __tests__/api.fake-guards.test.ts
import axios from 'axios';

jest.mock('axios');

describe('api.ts: фейк-сторажи', () => {
  const realEnv = process.env.NODE_ENV;
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.resetModules();
    (axios.post as jest.Mock).mockReset().mockResolvedValue({
      data: { st: true, text: '', data: { ok: true } },
    });
    (global as any).__FAKE_ORDERS__ = undefined;
    (global as any).__FAKE_HIDDEN_IDS__ = undefined;
  });

  afterAll(() => {
    process.env.NODE_ENV = realEnv;
    logSpy.mockRestore();
  });

  /**
   * Запускаем код в изоляции и возвращаем,
   * сколько раз дернули ИМЕННО тот axios.post,
   * который видит изолированный модуль.
   */
  async function runIsolated({
    nodeEnv,
    devFlag,
    fakeMode,
    call,
  }: {
    nodeEnv: 'production' | 'development';
    devFlag: boolean;
    fakeMode?: 'off' | 'actions';
    call: (api: any) => Promise<any> | any;
  }): Promise<{ postCalls: number }> {
    let postCalls = 0;

    await jest.isolateModulesAsync(async () => {
      process.env.NODE_ENV = nodeEnv;

      Object.defineProperty(global as any, '__DEV__', {
        value: devFlag,
        configurable: true,
        writable: true,
      });

      (global as any).__FAKE_ORDERS__ = fakeMode;

      const { api } = require('@/shared/store/api');

      // ⚠️ берем axios из ЭТОЙ ЖЕ изоляции
      const axiosLocal = require('axios');
      const postLocal = axiosLocal.post as jest.Mock;

      await call(api);

      postCalls = postLocal.mock.calls.length;
    });

    return { postCalls };
  }

  it('PROD: всегда реальный бэк, даже если __FAKE_ORDERS__=actions', async () => {
    const { postCalls } = await runIsolated({
      nodeEnv: 'production',
      devFlag: false,
      fakeMode: 'actions',
      call: (api) => api('orders', { type: 'actionOrder', id: 1, type_action: 1 }),
    });
    expect(postCalls).toBe(1);
  });

  it('DEV + off: реальный бэк', async () => {
    const { postCalls } = await runIsolated({
      nodeEnv: 'development',
      devFlag: true,
      fakeMode: 'off',
      call: (api) => api('orders', { type: 'actionOrder', id: 1, type_action: 1 }),
    });
    expect(postCalls).toBe(1);
  });

  it('DEV + actions: перехват, axios.post не зовём', async () => {
    const { postCalls } = await runIsolated({
      nodeEnv: 'development',
      devFlag: true,
      fakeMode: 'actions',
      call: (api) => api('orders', { type: 'actionOrder', id: 1, type_action: 1 }),
    });
    expect(postCalls).toBe(0);
  });
});
