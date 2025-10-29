// __tests__/ui.order-actions.my-actions.test.tsx
/**
 * Назначение:
 *   Проверяет корректность вызовов подтверждений у «моего» заказа.
 *
 * Что покрываем:
 *   • «Отменить» → setActiveConfirm(true, id, 'cancel', is_delete)
 *   • «Завершить» → setActiveConfirm(true, id, 'finish', is_delete)
 *   • «Клиент не вышел…» → setActiveConfirm(true, id, 'fake', is_delete)
 *
 * Зачем:
 *   Это конверсионные кнопки с побочными эффектами (изменение статуса/списка).
 *   Любой регресс в аргументах подтверждения приведёт к неверным действиям на бэке.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OrderActions } from '@/entities/CardOrder/ui/OrderActions';
import type { Order } from '@/shared/store/OrdersStoreType';

const makeOrder = (patch: Partial<Order>): Order =>
  ({
    id: 77,
    is_get: 1,
    is_my: 1,
    number: '79990001122',
    status_order: 0,
    online_pay: 0,
    is_delete: 0,
    driver_name: '',
    driver_login: '',
    addr: 'A',
    pd: '1',
    et: '',
    kv: '',
    ...patch,
  } as Order);

test('мой заказ: cancel/finish/fake → корректные setActiveConfirm', () => {
  const item = makeOrder({});
  const setActiveConfirm = jest.fn();

  render(
    <OrderActions
      item={item}
      dialCall={jest.fn()}
      setActiveConfirm={setActiveConfirm}
      actionButtonOrder={jest.fn()}
      globalFontSize={16}
    />
  );

  fireEvent.press(screen.getByTestId(`order-${item.id}-cancel`));
  expect(setActiveConfirm).toHaveBeenCalledWith(true, item.id, 'cancel', false);

  fireEvent.press(screen.getByTestId(`order-${item.id}-finish`));
  expect(setActiveConfirm).toHaveBeenCalledWith(true, item.id, 'finish', false);

  fireEvent.press(screen.getByTestId(`order-${item.id}-fake`));
  expect(setActiveConfirm).toHaveBeenCalledWith(true, item.id, 'fake', false);

  expect(setActiveConfirm).toHaveBeenCalledTimes(3);
});

test('при online_pay=0 рядом с «Завершить» есть кнопка QR', () => {
  const item = makeOrder({ online_pay: 0 });
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
  expect(screen.getByTestId(`order-${item.id}-qr`)).toBeTruthy();
});
