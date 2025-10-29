// __tests__/order-take.autorefresh-off.test.ts
/**
 * Что проверяем
 * -------------
 * Баг: при отключённом автообновлении (update_interval=0) после нажатия "Взять"
 * "ничего не происходит". Мы починили это, вызвав showOrdersMap(-1) и getOrders()
 * вручную в экшенах actionOrder / actionOrderFake при успешном ответе API.
 *
 * В этом тесте подтверждаем:
 * 1) Обычный путь "Взять" (type=1, не fake-модалка) ⇒ вызываются showOrdersMap(-1) и getOrders().
 * 2) Путь "fake" (is_modalConfirm=true, type_confirm='fake') ⇒ тоже вызываются showOrdersMap(-1) и getOrders().
 *
 * Детали:
 * - Ставим update_interval=0, чтобы имитировать выключенное автообновление.
 * - Мокаем GEO-коллбеки так, чтобы они синхронно дергали переданный экшен.
 * - Мокаем api, чтобы вернуть успех.
 * - Проверяем, что после actionButtonOrder(..) были вызваны ручные обновления UI.
 */

import { act, waitFor } from '@testing-library/react-native';

// свежий импорт стора и api после resetModules
import * as Store from '@/shared/store/store';
import * as ApiMod from '@/shared/store/api';

describe('Автообновление=0: после "Взять" происходит ручной рефреш UI', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('Обычный "Взять" (type=1): вызывает showOrdersMap(-1) и getOrders() при update_interval=0', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } = require('@/shared/store/store') as typeof Store;
    const api = require('@/shared/store/api') as typeof ApiMod;

    // --- Моки GEO ---
    const check_pos = jest.fn((cb: any, payload: any) => cb({ data: payload, latitude: '', longitude: '' }));
    const check_pos_fake = jest.fn((cb: any, payload: any) => cb({ data: payload, latitude: '', longitude: '' }));
    useGEOStore.setState({ check_pos, check_pos_fake });

    // --- Моки UI/глобального стора ---
    const setSpinner = jest.fn();
    const showModalText = jest.fn();
    const getAuthToken = jest.fn().mockResolvedValue('token');
    useGlobalStore.setState({ setSpinner, showModalText, getAuthToken, notifToken: 'pushToken' });

    // --- Моки методов заказов, которые должны дернуться: ---
    const showOrdersMap = jest.fn();
    const getOrders = jest.fn();
    const setActiveConfirm = jest.fn();
    useOrdersStore.setState({ showOrdersMap, getOrders, setActiveConfirm });

    // --- Состояние стора под кейс: автообновление выключено ---
    useOrdersStore.setState({
      isClick: false,
      update_interval: 0,          // КЛЮЧЕВОЕ
      driver_need_gps: false,      // пусть будет без GPS → пойдём через check_pos_fake + actionOrder
      is_modalConfirm: false,      // НЕ fake-подтверждение
      type_confirm: '',            // чисто
      isOpenOrderMap: true,        // ← ДОБАВЬ: карта была открыта, значит ждём её закрытия
    });

    // --- API успех для actionOrder ---
   const apiSpy = jest.spyOn(api, 'api').mockResolvedValueOnce({ st: true, text: '' } as any);

    // --- Действие: жмём "Взять" ---
    await act(async () => {
      await useOrdersStore.getState().actionButtonOrder(1, 777);
    });

    // --- Ожидания ---
    expect(check_pos_fake).toHaveBeenCalledTimes(1); // гео проверка вызвана
    expect(apiSpy).toHaveBeenCalledWith('orders', expect.objectContaining({
      type: 'actionOrder', id: 777, type_action: 1,
    }));

    // Ручные обновления UI должны сработать немедленно
    expect(showOrdersMap).toHaveBeenCalledWith(-1);
    expect(getOrders).toHaveBeenCalled();

    // Спиннер в итоге погашен (точное кол-во вызовов не важно)
    await waitFor(() => {
      expect(setSpinner).toHaveBeenCalledWith(false);
    });

    // Прокрутим таймер, чтобы не оставлять хвостов (isClick reset через setTimeout)
    await act(async () => { jest.runOnlyPendingTimers(); });
  });

  it('Fake-путь (is_modalConfirm=true, type_confirm="fake"): вызывает showOrdersMap(-1) и getOrders() при update_interval=0', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } = require('@/shared/store/store') as typeof Store;
    const api = require('@/shared/store/api') as typeof ApiMod;

    // --- Моки GEO ---
    const check_pos = jest.fn((cb: any, payload: any) => cb({ data: payload, latitude: '', longitude: '' }));
    const check_pos_fake = jest.fn((cb: any, payload: any) => cb({ data: payload, latitude: '', longitude: '' }));
    useGEOStore.setState({ check_pos, check_pos_fake });

    // --- Моки UI/глобального стора ---
    const setSpinner = jest.fn();
    const showModalText = jest.fn();
    const getAuthToken = jest.fn().mockResolvedValue('token');
    useGlobalStore.setState({ setSpinner, showModalText, getAuthToken, notifToken: 'pushToken' });

    // --- Моки методов заказов ---
    const showOrdersMap = jest.fn();
    const getOrders = jest.fn();
    const setActiveConfirm = jest.fn();
    useOrdersStore.setState({ showOrdersMap, getOrders, setActiveConfirm });

    // --- Состояние: автообновление=0, из модалки fake ---
    useOrdersStore.setState({
      isClick: false,
      update_interval: 0,
      driver_need_gps: false,
      is_modalConfirm: true,       // ВАЖНО
      type_confirm: 'fake',        // ВАЖНО
      isOpenOrderMap: true,        // ← ДОБАВЬ: карта была открыта, значит ждём её закрытия
    });

    // --- API успех для actionOrderFake ---
    // --- API успех для actionOrderFake ---
   const apiSpy = jest.spyOn(api, 'api').mockResolvedValueOnce({ st: true, text: '' } as any);

    // --- Действие: жмём "Взять" (type=1), но путь будет fake ---
    await act(async () => {
      await useOrdersStore.getState().actionButtonOrder(1, 42);
    });

    // Для fake-пути дергается check_pos(_|_fake) → actionOrderFake → api: checkFakeOrder
    expect(apiSpy).toHaveBeenCalledWith('orders', expect.objectContaining({
      type: 'checkFakeOrder', order_id: 42,
    }));

    // И ручные обновления UI
    expect(showOrdersMap).toHaveBeenCalledWith(-1);
    expect(getOrders).toHaveBeenCalled();

    await waitFor(() => {
      expect(setSpinner).toHaveBeenCalledWith(false);
    });

    await act(async () => { jest.runOnlyPendingTimers(); });
  });
});
