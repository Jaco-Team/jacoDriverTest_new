// __tests__/order-take.ui-refresh.test.ts
/**
 * Проверяем ручной рефреш UI после "Взять" при автообновлении=0:
 * - Номинальный путь (actionOrder)
 * - Fake-путь (checkFakeOrder)
 * Для каждого: карта открыта → ждём showOrdersMap(-1) + getOrders(),
 *              карта закрыта → ждём только getOrders().
 */
import { act, waitFor } from '@testing-library/react-native';
import * as Store from '@/shared/store/store';
import * as ApiMod from '@/shared/store/api';

type Ctx = {
  mapOpen: boolean;
  path: 'nominal' | 'fake';
  title: string;
};

describe('Взять → ручной рефреш UI (автообновление=0)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  const cases: Ctx[] = [
    { path: 'nominal', mapOpen: true,  title: 'номинальный путь + карта открыта' },
    { path: 'nominal', mapOpen: false, title: 'номинальный путь + карта закрыта' },
    { path: 'fake',    mapOpen: true,  title: 'fake-путь + карта открыта' },
    { path: 'fake',    mapOpen: false, title: 'fake-путь + карта закрыта' },
  ];

  describe.each(cases)('%s', ({ path, mapOpen }) => {
    it(`${path} — ${mapOpen ? 'карта открыта' : 'карта закрыта'}`, async () => {
      const { useOrdersStore, useGEOStore, useGlobalStore } = require('@/shared/store/store') as typeof Store;
      const api = require('@/shared/store/api') as typeof ApiMod;

      // Гео: используем check_pos_fake, чтобы мгновенно вызвать экшен
      const check_pos_fake = jest.fn((fn: any, payload: any) => {
        fn({ data: payload, latitude: '', longitude: '' });
      });
      const check_pos = jest.fn((fn: any, payload: any) => {
        fn({ data: payload, latitude: '', longitude: '' });
      });
      useGEOStore.setState({ check_pos_fake, check_pos });

      // Глобалка: токен и спиннер
      const setSpinner = jest.fn();
      const showModalText = jest.fn();
      const getAuthToken = jest.fn().mockResolvedValue('token');
      useGlobalStore.setState({ setSpinner, getAuthToken, showModalText, notifToken: 'pushToken' });

      // Хуки на эффекты стора
      const showOrdersMap = jest.fn();
      const getOrders = jest.fn();
      useOrdersStore.setState({ showOrdersMap, getOrders });

      // Начальные флаги стора
      useOrdersStore.setState({
        update_interval: 0,
        driver_need_gps: false,      // чтобы пошёл через check_pos_fake
        is_modalConfirm: path === 'fake',
        type_confirm: path === 'fake' ? 'fake' : '',
        isOpenOrderMap: mapOpen,
      });

      // API ожидания
      const apiSpy = jest.spyOn(api, 'api').mockResolvedValueOnce({ st: true, text: '' });

      // ДЕЙСТВИЕ: "Взять"
      act(() => {
        useOrdersStore.getState().actionButtonOrder(1, 777);
      });

      // ждём вызова API
      await waitFor(() => expect(apiSpy).toHaveBeenCalled());

      // Проверяем тип запроса
      if (path === 'nominal') {
        expect(apiSpy).toHaveBeenCalledWith(
          'orders',
          expect.objectContaining({ type: 'actionOrder', id: 777, type_action: 1 })
        );
      } else {
        expect(apiSpy).toHaveBeenCalledWith(
          'orders',
          expect.objectContaining({ type: 'checkFakeOrder', order_id: 777 })
        );
      }

      // Проверяем эффекты UI
      if (mapOpen) {
        expect(showOrdersMap).toHaveBeenCalledWith(-1);
      } else {
        expect(showOrdersMap).not.toHaveBeenCalled();
      }
      expect(getOrders).toHaveBeenCalled();
    });
  });
});
