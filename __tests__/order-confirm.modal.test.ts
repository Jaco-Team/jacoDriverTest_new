/**
 * ТЕСТЫ МОДАЛКИ ПОДТВЕРЖДЕНИЯ:
 * 1) setActiveConfirm(true, ...) — НЕ сбрасывает type_confirm, модалка открыта.
 *    setActiveConfirm(false, ...) — сбрасывает type_confirm в '' и закрывает модалку.
 * 2) После успешного экшена setActiveConfirm(false) вызывается ТОЛЬКО если
 *    модалка была открыта (is_modalConfirm=true).
 */

import { waitFor } from '@testing-library/react-native';

// Глушим аналитику
jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: jest.fn() },
  AnalyticsEvent: {},
}));

describe('Модалка подтверждения: setActiveConfirm и автозакрытие на success', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('setActiveConfirm: true — не сбрасывает; false — сбрасывает type_confirm', () => {
    const { useOrdersStore } = require('@/shared/store/store');

    // Открываем модалку
    useOrdersStore.getState().setActiveConfirm(true, 123, 'fake', false);
    let s = useOrdersStore.getState();
    expect(s.is_modalConfirm).toBe(true);
    expect(s.order_confirm_id).toBe(123);
    expect(s.type_confirm).toBe('fake');

    // Закрываем модалку
    useOrdersStore.getState().setActiveConfirm(false, 123, 'fake', false);
    s = useOrdersStore.getState();
    expect(s.is_modalConfirm).toBe(false);
    expect(s.type_confirm).toBe(''); // ← сброшено
  });

  it('success: setActiveConfirm(false) вызывается, ЕСЛИ модалка была открыта', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } = require('@/shared/store/store');

    // GEO: сразу вызываем коллбек
    const check_pos_fake = jest.fn((cb: any, payload: any) => cb({ data: payload }));
    useGEOStore.setState({ check_pos_fake });

    // Глобалка
    useGlobalStore.setState({
      setSpinner: jest.fn(),
      getAuthToken: jest.fn().mockResolvedValue('token'),
      showModalText: jest.fn(),
      notifToken: 'pushToken',
    });

    // Мокаем setActiveConfirm, чтобы отследить вызовы
    const setActiveConfirm = jest.fn();
    useOrdersStore.setState({
      driver_need_gps: false,
      is_modalConfirm: true,           // ← модалка открыта
      setActiveConfirm,
      isOpenOrderMap: false,
      showOrdersMap: jest.fn(),
      getOrders: jest.fn(),
    });

    const apiSpy = jest
      .spyOn(require('@/shared/store/api'), 'api')
      .mockResolvedValueOnce({ st: true, text: '' });

    // Нажимаем любое успешное действие, например "Отменить" (type=2)
    useOrdersStore.getState().actionButtonOrder(2, 777);

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());
    expect(setActiveConfirm).toHaveBeenCalledWith(false);
  });

  it('success: setActiveConfirm(false) НЕ вызывается, если модалка НЕ была открыта', async () => {
    const { useOrdersStore, useGEOStore, useGlobalStore } = require('@/shared/store/store');

    const check_pos_fake = jest.fn((cb: any, payload: any) => cb({ data: payload }));
    useGEOStore.setState({ check_pos_fake });

    useGlobalStore.setState({
      setSpinner: jest.fn(),
      getAuthToken: jest.fn().mockResolvedValue('token'),
      showModalText: jest.fn(),
      notifToken: 'pushToken',
    });

    const setActiveConfirm = jest.fn();
    useOrdersStore.setState({
      driver_need_gps: false,
      is_modalConfirm: false,          // ← модалка закрыта
      setActiveConfirm,
      isOpenOrderMap: false,
      showOrdersMap: jest.fn(),
      getOrders: jest.fn(),
    });

    const apiSpy = jest
      .spyOn(require('@/shared/store/api'), 'api')
      .mockResolvedValueOnce({ st: true, text: '' });

    useOrdersStore.getState().actionButtonOrder(2, 42);

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());
    expect(setActiveConfirm).not.toHaveBeenCalled();
  });
});
