// __tests__/ui.order-actions.is-delete-flag.test.tsx
/**
 * Назначение:
 *   Проверяем, что при отменённом клиентом заказе (is_delete=1) все экшены
 *   пробрасывают в setActiveConfirm четвертый аргумент true.
 *
 * Что покрываем:
 *   • Нажатие «Отменить», «Завершить», «Клиент не вышел…»
 *   • Аргументы: setActiveConfirm(true, id, 'cancel'|'finish'|'fake', true)
 *
 * Зачем:
 *   Бэку важно знать, что заказ уже был отменён клиентом. Неверный флаг
 *   приведёт к неправильной бизнес-логике на сервере.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OrderActions } from '@/entities/CardOrder/ui/OrderActions';
import type { Order } from '@/shared/store/OrdersStoreType';

const makeOrder = (patch: Partial<Order>): Order =>
  ({
    id: 888,
    is_get: 1,
    is_my: 1,
    number: '79998887766',
    status_order: 0,
    online_pay: 0,
    is_delete: 1, // ключевое
    driver_name: '',
    driver_login: '',
    addr: 'A',
    pd: '1',
    et: '',
    kv: '',
    ...patch,
  } as Order);

test('is_delete=1: все экшены передают is_delete=true в setActiveConfirm', () => {
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

  // cancel
  fireEvent.press(screen.getByTestId(`order-${item.id}-cancel`));
  expect(setActiveConfirm).toHaveBeenNthCalledWith(1, true, item.id, 'cancel', true);

  // finish
  fireEvent.press(screen.getByTestId(`order-${item.id}-finish`));
  expect(setActiveConfirm).toHaveBeenNthCalledWith(2, true, item.id, 'finish', true);

  // fake
  fireEvent.press(screen.getByTestId(`order-${item.id}-fake`));
  expect(setActiveConfirm).toHaveBeenNthCalledWith(3, true, item.id, 'fake', true);

  expect(setActiveConfirm).toHaveBeenCalledTimes(3);
});
