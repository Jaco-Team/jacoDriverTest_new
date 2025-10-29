// __tests__/order-ui-close.guards.test.ts
/**
 * ТЕСТЫ: Закрытие UI по условиям после успешного действия
 *
 * ЗАЧЕМ:
 * - Зафиксировать, что:
 *   1) showOrdersMap(-1) вызывается ТОЛЬКО если isOpenOrderMap === true.
 *   2) setActiveConfirm(false) вызывается ТОЛЬКО если is_modalConfirm === true.
 *
 * ПОКРЫТИЕ:
 * - Нажатие "Взять" (type=1), обычный путь → actionOrder (API: st=true).
 * - Ветки с разными начальными флагами isOpenOrderMap / is_modalConfirm.
 */

import { act, waitFor } from '@testing-library/react-native';
import * as Store from '@/shared/store/store';
import * as ApiMod from '@/shared/store/api';

describe('Закрытие UI по условиям', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function setupEnv({
    isOpenOrderMap,
    is_modalConfirm,
  }: {
    isOpenOrderMap: boolean;
    is_modalConfirm: boolean;
  }) {
    const { useOrdersStore, useGEOStore, useGlobalStore } =
      require('@/shared/store/store') as typeof Store;
    const api = require('@/shared/store/api') as typeof ApiMod;

    // GEO: обычный "Взять" идёт через check_pos_fake
    const check_pos_fake = jest.fn((cb: any, payload: any) =>
      cb({ data: payload, latitude: '', longitude: '' })
    );
    useGEOStore.setState({ check_pos_fake });

    // Глобальные заглушки
    const setSpinner = jest.fn();
    const showModalText = jest.fn();
    const getAuthToken = jest.fn().mockResolvedValue('token');
    useGlobalStore.setState({
      setSpinner,
      showModalText,
      getAuthToken,
      notifToken: 'pushToken',
    });

    // Методы заказов
    const showOrdersMap = jest.fn();
    const getOrders = jest.fn();
    const setActiveConfirm = jest.fn();

    useOrdersStore.setState({
      showOrdersMap,
      getOrders,
      setActiveConfirm,
      // флаги, которые мы варьируем в тестах:
      isOpenOrderMap,
      is_modalConfirm,
      // остальное — номинальный путь
      driver_need_gps: true,
      type_confirm: '',
    });

    // API: успех
    const apiSpy = jest.spyOn(api, 'api').mockResolvedValueOnce({ st: true, text: '' });

    return {
      useOrdersStore,
      setSpinner,
      showModalText,
      showOrdersMap,
      getOrders,
      setActiveConfirm,
      apiSpy,
      check_pos_fake,
    };
  }

  it('карта открыта: после успеха вызывается showOrdersMap(-1)', async () => {
    const { useOrdersStore, apiSpy, showOrdersMap } = setupEnv({
      isOpenOrderMap: true,
      is_modalConfirm: false,
    });

    act(() => {
      useOrdersStore.getState().actionButtonOrder(1, 101); // "Взять"
    });

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());
    expect(showOrdersMap).toHaveBeenCalledWith(-1);
  });

  it('карта закрыта: после успеха НЕ вызывается showOrdersMap(-1)', async () => {
    const { useOrdersStore, apiSpy, showOrdersMap } = setupEnv({
      isOpenOrderMap: false,
      is_modalConfirm: false,
    });

    act(() => {
      useOrdersStore.getState().actionButtonOrder(1, 102);
    });

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());
    expect(showOrdersMap).not.toHaveBeenCalledWith(-1);
  });

  it('модалка подтверждения открыта: после успеха вызывается setActiveConfirm(false)', async () => {
    const { useOrdersStore, apiSpy, setActiveConfirm } = setupEnv({
      isOpenOrderMap: false,
      is_modalConfirm: true,
    });

    act(() => {
      useOrdersStore.getState().actionButtonOrder(1, 103);
    });

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());
    expect(setActiveConfirm).toHaveBeenCalledWith(false);
  });

  it('модалка подтверждения закрыта: после успеха НЕ вызывается setActiveConfirm(false)', async () => {
    const { useOrdersStore, apiSpy, setActiveConfirm } = setupEnv({
      isOpenOrderMap: true,
      is_modalConfirm: false,
    });

    act(() => {
      useOrdersStore.getState().actionButtonOrder(1, 104);
    });

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());
    expect(setActiveConfirm).not.toHaveBeenCalled();
  });
});
