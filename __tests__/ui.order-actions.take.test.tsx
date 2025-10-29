/**
 * RNTL интеграция для OrderActions — сценарии «Взять».
 * 1) При is_get=0 кнопка «Взять» видна и вызывает actionButtonOrder(1, id).
 * 2) При моём/чужом заказе кнопки «Взять» нет.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react-native';
import type { Order } from '@/shared/store/OrdersStoreType';

/* ========= ХЕЛПЕРЫ ========= */

// Минимальный «скелет» под Order — строки для pd/et/kv
const orderDefaults: Partial<Order> = {
  id: 0,
  is_get: 0,
  is_my: 0,
  number: '',
  status_order: 0,
  online_pay: 0,
  is_delete: 0,
  driver_name: '',
  driver_login: '',
  addr: '',
  pd: '',
  et: '',
  kv: '',
};

const makeOrder = (patch: Partial<Order>): Order =>
  ({ ...orderDefaults, ...patch } as Order);

type OrderActionsProps = {
  item: Order;
  dialCall: (n: string) => void;
  setActiveConfirm: (v: boolean, id: number, type: string, is_delete: boolean) => void;
  actionButtonOrder: (type: number, id: number) => void;
  globalFontSize: number;
};

function makeProps(overrides: Partial<OrderActionsProps> = {}): OrderActionsProps {
  return {
    item: makeOrder({
      id: 101,
      is_get: 0,
      is_my: 0,
      number: '79990000000',
      status_order: 0,
      online_pay: 0,
      is_delete: 0,
      driver_name: '',
      driver_login: '',
      addr: 'A',
      pd: '1',
    }),
    dialCall: jest.fn(),
    setActiveConfirm: jest.fn(),
    actionButtonOrder: jest.fn(),
    globalFontSize: 16,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  jest.clearAllTimers(); // на всякий случай прибираем фейковые таймеры
});

/* ========= ТЕСТЫ ========= */
describe('OrderActions — кнопка «Взять»', () => {
  it('is_get=0: видна и вызывает actionButtonOrder(1, id)', () => {
    const { OrderActions } = require('@/entities/CardOrder/ui/OrderActions');

    const props = makeProps();
    const { unmount } = render(<OrderActions {...props} />);

    const takeBtn = screen.getByTestId(`order-${props.item.id}-take`);
    fireEvent.press(takeBtn);

    expect(props.actionButtonOrder).toHaveBeenCalledTimes(1);
    expect(props.actionButtonOrder).toHaveBeenCalledWith(1, props.item.id);

    const phoneBtn = screen.getByTestId(`order-${props.item.id}-phone`);
    fireEvent.press(phoneBtn);
    expect(props.dialCall).toHaveBeenCalledWith(props.item.number);

    unmount();
  });

  it('мой/чужой заказ: «Взять» отсутствует', () => {
    const { OrderActions } = require('@/entities/CardOrder/ui/OrderActions');

    // --- мой заказ ---
    const propsMine = makeProps({
      item: makeOrder({
        id: 1,
        is_get: 1,
        is_my: 1,
        number: '7',
        status_order: 0,
        online_pay: 1, 
        is_delete: 0,
        driver_name: '',
        driver_login: '',
        addr: 'A',
        pd: '1',
      }),
    });

    const utilsMine = render(<OrderActions {...propsMine} />);
    expect(screen.queryByTestId(`order-${propsMine.item.id}-take`)).toBeNull();
    utilsMine.unmount();

    //--- чужой заказ ---
    const propsOther = makeProps({
      item: makeOrder({
        id: 2,
        is_get: 1,
        is_my: 0,
        number: '7',
        status_order: 0,
        online_pay: 0,
        is_delete: 0,
        driver_name: 'Vasya',
        driver_login: 'vasya',
        addr: 'B',
        pd: '2',
      }),
    });

    const utilsOther = render(<OrderActions {...propsOther} />);
    expect(screen.queryByTestId(`order-${propsOther.item.id}-take`)).toBeNull();
    utilsOther.unmount();
  });


});

