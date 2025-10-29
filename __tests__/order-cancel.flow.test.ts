/**
 * Тест: поток "Отменить" (type=2)
 * Зачем: убедиться, что при отмене заказа корректно выбирается ветка геопроверки
 * (check_pos vs check_pos_fake), уходит запрос actionOrder(type=2), а на успехе
 * выполняется ручной рефреш UI: getOrders() и (если карта была открыта) showOrdersMap(-1).
 */

import { act, waitFor } from '@testing-library/react-native';

import * as Store from '@/shared/store/store';
import * as ApiMod from '@/shared/store/api';

describe('Кнопка "Отменить" — ветки GPS и карта', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const runCase = async ({
    gps,
    mapOpen,
  }: {
    gps: boolean;
    mapOpen: boolean;
  }) => {
    const { useOrdersStore, useGEOStore, useGlobalStore } =
      require('@/shared/store/store') as typeof Store;
    const api = require('@/shared/store/api') as typeof ApiMod;

    // --- GEO моки: оба пути вызывают переданный коллбэк сразу
    const check_pos = jest.fn((cb: any, payload: any) =>
      cb({ data: payload, latitude: '', longitude: '' })
    );
    const check_pos_fake = jest.fn((cb: any, payload: any) =>
      cb({ data: payload, latitude: '', longitude: '' })
    );
    useGEOStore.setState({ check_pos, check_pos_fake });

    // --- Глобалка
    const setSpinner = jest.fn();
    const showModalText = jest.fn();
    const getAuthToken = jest.fn().mockResolvedValue('token');
    useGlobalStore.setState({
      setSpinner,
      showModalText,
      getAuthToken,
      notifToken: 'pushToken',
    });

    // --- Методы стора заказов
    const showOrdersMap = jest.fn();
    const getOrders = jest.fn();
    const setActiveConfirm = jest.fn();
    useOrdersStore.setState({
      showOrdersMap,
      getOrders,
      setActiveConfirm,
      isOpenOrderMap: mapOpen,
    });

    // --- Состояние для кейса
    useOrdersStore.setState({
      isClick: false,
      driver_need_gps: gps,
      is_modalConfirm: false,
      type_confirm: '',
      update_interval: 0,
    });

    // --- API успех
    const apiSpy = jest
      .spyOn(api, 'api')
      .mockResolvedValueOnce({ st: true, text: '' } as any);

    // --- Действие: Отменить (type=2)
    await act(async () => {
      useOrdersStore.getState().actionButtonOrder(2, 555);
    });

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());

    // Проверка ветки GEO
    if (gps) {
      expect(check_pos).toHaveBeenCalledTimes(1);
      expect(check_pos_fake).not.toHaveBeenCalled();
    } else {
      expect(check_pos_fake).toHaveBeenCalledTimes(1);
      expect(check_pos).not.toHaveBeenCalled();
    }

    // Проверка API параметров
    expect(apiSpy).toHaveBeenCalledWith(
      'orders',
      expect.objectContaining({
        type: 'actionOrder',
        id: 555,
        type_action: 2,
      })
    );

    // Ручной рефреш UI
    if (mapOpen) {
      expect(showOrdersMap).toHaveBeenCalledWith(-1);
    } else {
      expect(showOrdersMap).not.toHaveBeenCalled();
    }
    expect(getOrders).toHaveBeenCalled();

    // Спиннер погашен
    await waitFor(() => {
      expect(setSpinner).toHaveBeenCalledWith(false);
    });
  };

  it.each([
    { gps: true, mapOpen: true, title: 'gps=true, карта открыта' },
    { gps: true, mapOpen: false, title: 'gps=true, карта закрыта' },
    { gps: false, mapOpen: true, title: 'gps=false, карта открыта' },
    { gps: false, mapOpen: false, title: 'gps=false, карта закрыта' },
  ])('Отменить: $title', async (p) => {
    await runCase(p);
  });
});
