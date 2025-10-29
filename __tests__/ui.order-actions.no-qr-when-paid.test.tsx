// __tests__/ui.order-actions.no-qr-when-paid.test.tsx
/**
 * Назначение:
 *   Для моего заказа с online_pay=1 QR не рендерится, «Завершить» доступна.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OrderActions } from '@/entities/CardOrder/ui/OrderActions';
import type { Order } from '@/shared/store/OrdersStoreType';

const makeOrder = (p: Partial<Order>): Order => ({
  id: 555,
  is_get: 1,
  is_my: 1,
  number: '79990000000',
  status_order: 0,
  online_pay: 1, // оплачено
  is_delete: 0,
  driver_name: '',
  driver_login: '',
  addr: 'A',
  pd: '1',
  et: '',
  kv: '',
  ...p,
} as Order);

test('online_pay=1: QR отсутствует, «Завершить» есть', () => {
  const item = makeOrder({});
  render(
    <OrderActions
      item={item}
      dialCall={jest.fn()}
      setActiveConfirm={jest.fn()}
      actionButtonOrder={jest.fn()}
      globalFontSize={16}
    />
  );

  expect(screen.getByTestId(`order-${item.id}-finish`)).toBeTruthy();
  expect(screen.queryByTestId(`order-${item.id}-qr`)).toBeNull();
});
