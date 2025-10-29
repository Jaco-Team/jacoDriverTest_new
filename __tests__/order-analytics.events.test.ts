/**
 * ТЕСТЫ АНАЛИТИКИ (AppMetrica):
 * - ConfirmApprove для путей: nominal/fake/cancel/finish
 * - OrderMapOpen/OrderMapClose
 * - ConfirmModalOpen/ConfirmModalClose
 *
 * Подход:
 * - Мокаем Analytics.log и считываем его вызовы.
 * - Для actionButtonOrder мокаем GEO-коллбек и api() → st:true.
 * - Для карты/модалки вызываем соответствующие методы стора.
 */

import { waitFor } from '@testing-library/react-native';

// Мок аналитики (импорт по именам!)
jest.mock('@/analytics/AppMetricaService', () => {
  const log = jest.fn();
  return {
    Analytics: { log },
    AnalyticsEvent: {
      ConfirmApprove: 'ConfirmApprove',
      OrderMapOpen: 'OrderMapOpen',
      OrderMapClose: 'OrderMapClose',
      ConfirmModalOpen: 'ConfirmModalOpen',
      ConfirmModalClose: 'ConfirmModalClose',
    },
  };
});

describe('Analytics: события для действий и UI', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const getLogMock = () => {
    const { Analytics } = require('@/analytics/AppMetricaService');
    return (Analytics.log as unknown) as jest.Mock;
  };

  it('ConfirmApprove — nominal: "Взятие заказа"', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } = require('@/shared/store/store');
    const { api } = require('@/shared/store/api');

    // GEO → сразу зовём cb
    const check_pos_fake = jest.fn((cb: any, payload: any) => cb({ data: payload }));
    useGEOStore.setState({ check_pos_fake });

    // Глобальные зависимости
    useGlobalStore.setState({
      setSpinner: jest.fn(),
      getAuthToken: jest.fn().mockResolvedValue('token'),
      showModalText: jest.fn(),
      notifToken: 'pushToken',
    });

    // Стор заказов — без открытой карты, чтобы не ловить OrderMapClose
    useOrdersStore.setState({
      driver_need_gps: false,
      is_modalConfirm: false,
      type_confirm: '',
      isOpenOrderMap: false,
      showOrdersMap: jest.fn(),
      getOrders: jest.fn(),
    });

    // API успех
    const apiSpy = jest.spyOn(require('@/shared/store/api'), 'api').mockResolvedValueOnce({ st: true, text: '' });

    // Действие
    useOrdersStore.getState().actionButtonOrder(1, 111);

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());

    // Проверяем аналитику
    const log = getLogMock();
    const approveCalls = log.mock.calls.filter(([event]) => event === 'ConfirmApprove');
    expect(approveCalls).toHaveLength(1);
    expect(approveCalls[0][1]).toBe('Взятие заказа');
  });

  it('ConfirmApprove — fake: "Клиент не вышел на связь"', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } = require('@/shared/store/store');

    const check_pos = jest.fn((cb: any, payload: any) => cb({ data: payload }));
    const check_pos_fake = jest.fn((cb: any, payload: any) => cb({ data: payload }));
    useGEOStore.setState({ check_pos, check_pos_fake });

    useGlobalStore.setState({
      setSpinner: jest.fn(),
      getAuthToken: jest.fn().mockResolvedValue('token'),
      showModalText: jest.fn(),
      notifToken: 'pushToken',
    });

    useOrdersStore.setState({
      driver_need_gps: true,        // в fake-пути это приведёт к check_pos
      is_modalConfirm: true,
      type_confirm: 'fake',
      isOpenOrderMap: false,
      showOrdersMap: jest.fn(),
      getOrders: jest.fn(),
    });

    jest.spyOn(require('@/shared/store/api'), 'api').mockResolvedValueOnce({ st: true, text: '' });

    useOrdersStore.getState().actionButtonOrder(1, 222);

    // ждём любой вызов api (actionOrderFake)
    await waitFor(() => expect(getLogMock).toBeDefined());

    const log = getLogMock();
    const approveCalls = log.mock.calls.filter(([event]) => event === 'ConfirmApprove');
    expect(approveCalls).toHaveLength(1);
    expect(approveCalls[0][1]).toBe('Клиент не вышел на связь');
  });

  it('ConfirmApprove — cancel: "Заказ отменен"', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } = require('@/shared/store/store');

    const check_pos_fake = jest.fn((cb: any, payload: any) => cb({ data: payload }));
    useGEOStore.setState({ check_pos_fake });

    useGlobalStore.setState({
      setSpinner: jest.fn(),
      getAuthToken: jest.fn().mockResolvedValue('token'),
      showModalText: jest.fn(),
      notifToken: 'pushToken',
    });

    useOrdersStore.setState({
      driver_need_gps: false,
      is_modalConfirm: false,
      isOpenOrderMap: false,
      showOrdersMap: jest.fn(),
      getOrders: jest.fn(),
    });

    jest.spyOn(require('@/shared/store/api'), 'api').mockResolvedValueOnce({ st: true, text: '' });

    useOrdersStore.getState().actionButtonOrder(2, 333);

    const log = getLogMock();
    const approveCalls = log.mock.calls.filter(([event]) => event === 'ConfirmApprove');
    expect(approveCalls).toHaveLength(1);
    expect(approveCalls[0][1]).toBe('Заказ отменен');
  });

  it('ConfirmApprove — finish: "Заказ завершен"', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } = require('@/shared/store/store');

    const check_pos_fake = jest.fn((cb: any, payload: any) => cb({ data: payload }));
    useGEOStore.setState({ check_pos_fake });

    useGlobalStore.setState({
      setSpinner: jest.fn(),
      getAuthToken: jest.fn().mockResolvedValue('token'),
      showModalText: jest.fn(),
      notifToken: 'pushToken',
    });

    useOrdersStore.setState({
      driver_need_gps: false,
      is_modalConfirm: false,
      isOpenOrderMap: false,
      showOrdersMap: jest.fn(),
      getOrders: jest.fn(),
    });

    jest.spyOn(require('@/shared/store/api'), 'api').mockResolvedValueOnce({ st: true, text: '' });

    useOrdersStore.getState().actionButtonOrder(3, 444);

    const log = getLogMock();
    const approveCalls = log.mock.calls.filter(([event]) => event === 'ConfirmApprove');
    expect(approveCalls).toHaveLength(1);
    expect(approveCalls[0][1]).toBe('Заказ завершен');
  });

  it('OrderMapOpen/OrderMapClose — логируются по факту открытия/закрытия', () => {
    const { useOrdersStore } = require('@/shared/store/store');
    const log = getLogMock();

    // чтобы showOrdersMap смог открыть — в orders должен быть элемент с таким id
    useOrdersStore.setState({
      orders: [
        { id: 1, addr: 'A', pd: '1' },
        { id: 2, addr: 'A', pd: '1' },
      ],
      isOpenOrderMap: false,
    });

    // Открываем
    useOrdersStore.getState().showOrdersMap(1);
    const openCalls = log.mock.calls.filter(([e]) => e === 'OrderMapOpen');
    expect(openCalls).toHaveLength(1);

    // Закрываем
    useOrdersStore.getState().showOrdersMap(-1);
    const closeCalls = log.mock.calls.filter(([e]) => e === 'OrderMapClose');
    expect(closeCalls).toHaveLength(1);

    // Повторно закрываем (уже закрыто) — не должно добавлять ещё один лог
    const before = closeCalls.length;
    useOrdersStore.getState().showOrdersMap(-1);
    const closeCallsAfter = log.mock.calls.filter(([e]) => e === 'OrderMapClose');
    expect(closeCallsAfter).toHaveLength(before);
  });

  it('ConfirmModalOpen/ConfirmModalClose — логируются при открытии/закрытии', () => {
    const { useOrdersStore } = require('@/shared/store/store');
    const log = getLogMock();

    useOrdersStore.getState().setActiveConfirm(true, 999, 'fake', false);
    const openCalls = log.mock.calls.filter(([e]) => e === 'ConfirmModalOpen');
    expect(openCalls).toHaveLength(1);

    useOrdersStore.getState().setActiveConfirm(false, 999, 'fake', false);
    const closeCalls = log.mock.calls.filter(([e]) => e === 'ConfirmModalClose');
    expect(closeCalls).toHaveLength(1);
  });
});
