/**
 * Кнопка «Взять» — номинальный путь (счастливый сценарий).
 * Цель: зафиксировать, что при driver_need_gps=true Обычный путь ВСЕГДА идёт через check_pos_fake,
 * затем actionOrder и ручной рефреш UI.
 */

import { act, waitFor } from '@testing-library/react-native';
import * as Store from '@/shared/store/store';
import * as ApiMod from '@/shared/store/api';

describe('Кнопка "Взять" — номинальный путь', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('gps=true, type_confirm="": check_pos_fake -> actionOrder -> success', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } =
      require('@/shared/store/store') as typeof Store;
    const api = require('@/shared/store/api') as typeof ApiMod;

    // --- Моки гео: важна проверка выбора ВЕТКИ ---
    const check_pos = jest.fn(); // не должен вызываться в номинальном пути
    const check_pos_fake = jest.fn((fn: any, payload: any) => {
      fn({ data: payload, latitude: '', longitude: '' });
    });
    useGEOStore.setState({ check_pos, check_pos_fake });

    // --- Глобалка: чтобы actionOrder не падал ---
    const setSpinner = jest.fn();
    const getAuthToken = jest.fn().mockResolvedValue('token');
    const showModalText = jest.fn();
    useGlobalStore.setState({ setSpinner, getAuthToken, showModalText, notifToken: 'pushToken' });

    // --- Сайд-эффекты стора заказов ---
    const showOrdersMap = jest.fn();
    const getOrders = jest.fn();
    useOrdersStore.setState({ showOrdersMap, getOrders });

    // --- Начальные флаги ---
    useOrdersStore.setState({
      driver_need_gps: true,
      type_confirm: '',
      is_modalConfirm: false,
      isOpenOrderMap: true, // карта «открыта» → ожидаем showOrdersMap(-1)
    });

    // --- API успех ---
    const apiSpy = jest.spyOn(api, 'api').mockResolvedValueOnce({ st: true, text: '' });

    // --- Действие ---
    act(() => {
      useOrdersStore.getState().actionButtonOrder(1, 123); // "Взять"
    });

    // дождёмся запроса
    await waitFor(() => expect(apiSpy).toHaveBeenCalled());

    // --- Ожидания ---
    // 1) выбрана правильная ветка гео
    expect(check_pos_fake).toHaveBeenCalledTimes(1);
    expect(check_pos).not.toHaveBeenCalled();

    // 2) правильный вызов API
    expect(apiSpy).toHaveBeenCalledWith(
      'orders',
      expect.objectContaining({
        type: 'actionOrder',
        id: 123,
        type_action: 1,
      })
    );

    // 3) ручной рефреш UI
    expect(showOrdersMap).toHaveBeenCalledWith(-1);
    expect(getOrders).toHaveBeenCalled();
  });
});
