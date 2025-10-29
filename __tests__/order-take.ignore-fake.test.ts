/**
 * «Взять» игнорирует залипший type_confirm='fake' (должен пойти обычный путь).
 * Цель: при driver_need_gps=true всё равно используем check_pos_fake и actionOrder, а не actionOrderFake.
 */

import { act, waitFor } from '@testing-library/react-native';
import * as Store from '@/shared/store/store';
import * as ApiMod from '@/shared/store/api';

describe('Кнопка "Взять" — игнорируем залипший type_confirm=fake', () => {
  beforeEach(() => { jest.resetModules(); });

  it('type=1: check_pos_fake -> actionOrder (а не actionOrderFake), при driver_need_gps=true', async () => {
    const { useOrdersStore, useGEOStore } = require('@/shared/store/store') as typeof Store;
    const api = require('@/shared/store/api') as typeof ApiMod;

    // Явно разводим гео-ветки, чтобы проверить, что берётся именно fake-ветка
    const check_pos = jest.fn(); // не должен вызываться
    const check_pos_fake = jest.fn((fn: any, payload: any) => fn({ data: payload }));
    useGEOStore.setState({ check_pos, check_pos_fake });

    useOrdersStore.setState({
      driver_need_gps: true,
      type_confirm: 'fake',       // «залипшее» значение
      is_modalConfirm: false,     // НЕ модалка fake — обычный путь
      isOpenOrderMap: false,
    });

    const apiSpy = jest.spyOn(api, 'api').mockResolvedValueOnce({ st: true, text: '' });

    act(() => {
      useOrdersStore.getState().actionButtonOrder(1, 42);
    });

    await waitFor(() => expect(apiSpy).toHaveBeenCalled());

    // Убедились, что пошли через check_pos_fake, а НЕ через check_pos
    expect(check_pos_fake).toHaveBeenCalledTimes(1);
    expect(check_pos).not.toHaveBeenCalled();

    // И вызвали обычный actionOrder (не checkFakeOrder)
    expect(apiSpy).toHaveBeenCalledWith(
      'orders',
      expect.objectContaining({ type: 'actionOrder', id: 42, type_action: 1 })
    );
  });
});
