import { act } from '@testing-library/react-native';

import { useGEOStore, useGlobalStore, useOrdersStore, useSettingsStore } from '@/shared/store/store';
import * as ApiMod from '@/shared/store/api';

describe('action_centered_map: центрирование после взятия/отмены', () => {
  const originalRequestMapHomeCenter = useOrdersStore.getState().requestMapHomeCenter;
  const originalActionOrder = useOrdersStore.getState().actionOrder;

  beforeEach(() => {
    jest.clearAllMocks();
    useGlobalStore.setState({
      setSpinner: jest.fn(),
      showModalText: jest.fn(),
      getAuthToken: jest.fn().mockResolvedValue('token'),
      notifToken: 'pushToken',
    } as any);
    useGEOStore.setState({
      check_pos: jest.fn((cb: any, payload: any) => cb({ data: payload })),
      check_pos_fake: jest.fn((cb: any, payload: any) => cb({ data: payload })),
    } as any);
    useOrdersStore.setState({
      actionOrder: originalActionOrder,
      requestMapHomeCenter: originalRequestMapHomeCenter,
      getOrders: jest.fn(),
      showOrdersMap: jest.fn(),
      setActiveConfirm: jest.fn(),
      isClick: false,
      isOpenOrderMap: true,
      is_modalConfirm: false,
      mapHomeCenterRequestId: 0,
    } as any);
    useSettingsStore.setState({
      action_centered_map: 0,
    } as any);
  });

  it('не просит вернуть карту домой, если настройка с сервера выключена', async () => {
    const apiSpy = jest.spyOn(ApiMod, 'api').mockResolvedValueOnce({ st: true, text: '' } as any);

    await act(async () => {
      await useOrdersStore.getState().actionOrder({ data: { order_id: 10, type: 1 } });
    });

    expect(apiSpy).toHaveBeenCalled();
    expect(useOrdersStore.getState().mapHomeCenterRequestId).toBe(0);
  });

  it('просит вернуть карту домой после взятия, если настройка включена', async () => {
    useSettingsStore.setState({ action_centered_map: 1 } as any);
    jest.spyOn(ApiMod, 'api').mockResolvedValueOnce({ st: true, text: '' } as any);

    await act(async () => {
      await useOrdersStore.getState().actionOrder({ data: { order_id: 10, type: 1 } });
    });

    expect(useOrdersStore.getState().mapHomeCenterRequestId).toBe(1);
  });

  it('просит вернуть карту домой после отмены, если настройка включена', async () => {
    useSettingsStore.setState({ action_centered_map: 1 } as any);
    jest.spyOn(ApiMod, 'api').mockResolvedValueOnce({ st: true, text: '' } as any);

    await act(async () => {
      await useOrdersStore.getState().actionOrder({ data: { order_id: 11, type: 2 } });
    });

    expect(useOrdersStore.getState().mapHomeCenterRequestId).toBe(1);
  });

  it('не центрирует карту после завершения заказа', async () => {
    useSettingsStore.setState({ action_centered_map: 1 } as any);
    jest.spyOn(ApiMod, 'api').mockResolvedValueOnce({ st: true, text: '' } as any);

    await act(async () => {
      await useOrdersStore.getState().actionOrder({ data: { order_id: 12, type: 3 } });
    });

    expect(useOrdersStore.getState().mapHomeCenterRequestId).toBe(0);
  });
});
