/**
 * Тест: GPS-ветвления для кнопки «Взять» (type=1)
 * Зачем:
 *  - Зафиксировать правила:
 *    1) Обычный путь (НЕ fake): ВСЕГДА используется check_pos_fake, даже если driver_need_gps=true.
 *    2) Fake-путь: check_pos / check_pos_fake выбирается строго по driver_need_gps.
 *  - Плюс проверяем, что уходит правильный API-колл и выполняется ручной рефреш UI.
 */

import { act, waitFor } from '@testing-library/react-native';
import * as Store from '@/shared/store/store';
import * as ApiMod from '@/shared/store/api';

describe('Взять (type=1): GPS-ветвления', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const baseSetup = () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } =
      require('@/shared/store/store') as typeof Store;
    const api = require('@/shared/store/api') as typeof ApiMod;

    // GEO моки
    const check_pos = jest.fn((cb: any, payload: any) =>
      cb({ data: payload, latitude: '', longitude: '' })
    );
    const check_pos_fake = jest.fn((cb: any, payload: any) =>
      cb({ data: payload, latitude: '', longitude: '' })
    );
    useGEOStore.setState({ check_pos, check_pos_fake });

    // Глобалка
    const setSpinner = jest.fn();
    const showModalText = jest.fn();
    const getAuthToken = jest.fn().mockResolvedValue('token');
    useGlobalStore.setState({
      setSpinner,
      showModalText,
      getAuthToken,
      notifToken: 'pushToken',
    });

    // Методы стора заказов
    const showOrdersMap = jest.fn();
    const getOrders = jest.fn();
    const setActiveConfirm = jest.fn();
    useOrdersStore.setState({
      showOrdersMap,
      getOrders,
      setActiveConfirm,
      isOpenOrderMap: true, // карта открыта → ждём showOrdersMap(-1)
    });

    // API успех
    const apiSpy = jest
      .spyOn(api, 'api')
      .mockResolvedValue({ st: true, text: '' } as any);

    return {
      useOrdersStore,
      check_pos,
      check_pos_fake,
      showOrdersMap,
      getOrders,
      apiSpy,
      setSpinner,
    };
  };

  it.each([
    { gps: false, title: 'обычный путь, gps=false → всегда check_pos_fake' },
    { gps: true,  title: 'обычный путь, gps=true  → всё равно check_pos_fake' },
  ])('$title', async ({ gps }) => {
    const {
      useOrdersStore,
      check_pos,
      check_pos_fake,
      showOrdersMap,
      getOrders,
      apiSpy,
      setSpinner,
    } = baseSetup();

    // Состояние: НЕ fake-модалка
    useOrdersStore.setState({
      isClick: false,
      driver_need_gps: gps,
      is_modalConfirm: false,
      type_confirm: '', // важно: НЕ 'fake'
      update_interval: 0,
    });

    await act(async () => {
      useOrdersStore.getState().actionButtonOrder(1, 111); // Взять
    });

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());

    // ✅ Всегда check_pos_fake
    expect(check_pos_fake).toHaveBeenCalledTimes(1);
    expect(check_pos).not.toHaveBeenCalled();

    // ✅ API параметры
    expect(apiSpy).toHaveBeenCalledWith(
      'orders',
      expect.objectContaining({ type: 'actionOrder', id: 111, type_action: 1 })
    );

    // ✅ Ручной рефреш UI
    expect(showOrdersMap).toHaveBeenCalledWith(-1);
    expect(getOrders).toHaveBeenCalled();

    // ✅ Спиннер погашен
    await waitFor(() => expect(setSpinner).toHaveBeenCalledWith(false));
  });

  it.each([
    { gps: true,  expectCheck: 'check_pos',       title: 'fake-путь, gps=true → check_pos' },
    { gps: false, expectCheck: 'check_pos_fake',  title: 'fake-путь, gps=false → check_pos_fake' },
  ])('$title', async ({ gps, expectCheck }) => {
    const {
      useOrdersStore,
      check_pos,
      check_pos_fake,
      showOrdersMap,
      getOrders,
      apiSpy,
      setSpinner,
    } = baseSetup();

    // Состояние: именно fake-подтверждение
    useOrdersStore.setState({
      isClick: false,
      driver_need_gps: gps,
      is_modalConfirm: true,
      type_confirm: 'fake',
      update_interval: 0,
    });

    await act(async () => {
      useOrdersStore.getState().actionButtonOrder(1, 222); // Взять (fake-путь)
    });

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());

    // ✅ Ветвление по gps
    if (expectCheck === 'check_pos') {
      expect(check_pos).toHaveBeenCalledTimes(1);
      expect(check_pos_fake).not.toHaveBeenCalled();
    } else {
      expect(check_pos_fake).toHaveBeenCalledTimes(1);
      expect(check_pos).not.toHaveBeenCalled();
    }

    // ✅ API для fake-пути
    expect(apiSpy).toHaveBeenCalledWith(
      'orders',
      expect.objectContaining({ type: 'checkFakeOrder', order_id: 222 })
    );

    // ✅ Ручной рефреш UI
    expect(showOrdersMap).toHaveBeenCalledWith(-1);
    expect(getOrders).toHaveBeenCalled();

    await waitFor(() => expect(setSpinner).toHaveBeenCalledWith(false));
  });
});
