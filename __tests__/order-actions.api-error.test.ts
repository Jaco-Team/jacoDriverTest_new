// __tests__/order-actions.api-error.test.ts
/**
 * ТЕСТЫ: Ошибки API при действиях с заказом (type=1 "Взять")
 *
 * ЗАЧЕМ:
 * - Зафиксировать, что при res.st === false мы показываем showModalText(true, text)
 *   и гарантированно гасим спиннер, не выполняя успех-сайд-эффекты.
 *
 * ПОКРЫВАЕМ:
 * 1) Обычный путь "Взять": check_pos_fake → actionOrder → (API st=false)
 *    → showModalText(true, text), setSpinner(false), НЕТ showOrdersMap(-1)/getOrders().
 * 2) Fake-путь: is_modalConfirm=true, type_confirm='fake'
 *    → check_pos (или check_pos_fake) → actionOrderFake → (API st=false)
 *    → showModalText(true, text), setSpinner(false), НЕТ showOrdersMap(-1)/getOrders().
 */

import { act, waitFor } from '@testing-library/react-native';
import * as Store from '@/shared/store/store';
import * as ApiMod from '@/shared/store/api';

describe('Действия с заказом: обработка ошибок API (st=false)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('Взять (nominal): API вернул st=false → showModalText(true, text), спиннер погашен, без UI-успехов', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } =
      require('@/shared/store/store') as typeof Store;
    const api = require('@/shared/store/api') as typeof ApiMod;

    // GEO: обычный "Взять" всегда идёт через check_pos_fake
    const check_pos_fake = jest.fn((cb: any, payload: any) =>
      cb({ data: payload, latitude: '', longitude: '' })
    );
    useGEOStore.setState({ check_pos_fake });

    // Глобальный стор
    const setSpinner = jest.fn();
    const showModalText = jest.fn();
    const getAuthToken = jest.fn().mockResolvedValue('token');
    useGlobalStore.setState({
      setSpinner,
      showModalText,
      getAuthToken,
      notifToken: 'pushToken',
    });

    // Методы заказов, которые НЕ должны вызываться при ошибке
    const showOrdersMap = jest.fn();
    const getOrders = jest.fn();
    useOrdersStore.setState({
      showOrdersMap,
      getOrders,
      // начальные флаги для пути nominal:
      driver_need_gps: true,
      type_confirm: '',
      is_modalConfirm: false,
      isOpenOrderMap: true, // даже если открыта — при ошибке закрывать не должны
    });

    // API: ошибка
    const apiSpy = jest
      .spyOn(api, 'api')
      .mockResolvedValueOnce({ st: false, text: 'Ошибка сервера' });

    // Действие
    act(() => {
      useOrdersStore.getState().actionButtonOrder(1, 111); // "Взять"
    });

    // ждём, пока отработает экшен
    await waitFor(() => expect(apiSpy).toHaveBeenCalled());

    // Ожидания
    expect(showModalText).toHaveBeenCalledWith(true, 'Ошибка сервера');

    // Спиннер обязательно погашен (в finally)
    await waitFor(() => {
      expect(setSpinner).toHaveBeenCalledWith(false);
    });

    // Успешные действия НЕ вызываются
    expect(showOrdersMap).not.toHaveBeenCalledWith(-1);
    expect(getOrders).not.toHaveBeenCalled();
  });

  it('Взять (fake-путь): API вернул st=false → showModalText(true, text), спиннер погашен, без UI-успехов', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } =
      require('@/shared/store/store') as typeof Store;
    const api = require('@/shared/store/api') as typeof ApiMod;

    // GEO: для fake-пути при driver_need_gps=true используется check_pos
    const check_pos = jest.fn((cb: any, payload: any) =>
      cb({ data: payload, latitude: '1', longitude: '1' })
    );
    const check_pos_fake = jest.fn(); // тут не нужен, но оставим для симметрии
    useGEOStore.setState({ check_pos, check_pos_fake });

    const setSpinner = jest.fn();
    const showModalText = jest.fn();
    const getAuthToken = jest.fn().mockResolvedValue('token');
    useGlobalStore.setState({
      setSpinner,
      showModalText,
      getAuthToken,
      notifToken: 'pushToken',
    });

    const showOrdersMap = jest.fn();
    const getOrders = jest.fn();
    useOrdersStore.setState({
      showOrdersMap,
      getOrders,
      driver_need_gps: true,     // заставим идти через check_pos
      is_modalConfirm: true,     // fake-подтверждение активно
      type_confirm: 'fake',
      isOpenOrderMap: true,
    });

    // API: ошибка на fake-ветке
    const apiSpy = jest
      .spyOn(api, 'api')
      .mockResolvedValueOnce({ st: false, text: 'Fake-ошибка' });

    act(() => {
      useOrdersStore.getState().actionButtonOrder(1, 222);
    });

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());

    expect(showModalText).toHaveBeenCalledWith(true, 'Fake-ошибка');

    await waitFor(() => {
      expect(setSpinner).toHaveBeenCalledWith(false);
    });

    expect(showOrdersMap).not.toHaveBeenCalledWith(-1);
    expect(getOrders).not.toHaveBeenCalled();
  });
});
