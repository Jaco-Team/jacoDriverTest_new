// __tests__/ui.order-actions.closed-order.test.tsx
/**
 * Назначение:
 *   Гарантирует, что для закрытого заказа (status_order=6) действия недоступны.
 *
 * Что покрываем:
 *   • Скрыты кнопки: Отменить, Завершить, Клиент не вышел на связь, QR.
 *   • Кнопка с номером телефона видна (можно позвонить клиенту при необходимости).
 *
 * Зачем:
 *   После закрытия нельзя менять статус заказa. Этот тест ловит любые регрессы
 *   в условиях показа action-кнопок.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OrderActions } from '@/entities/CardOrder/ui/OrderActions';
import type { Order } from '@/shared/store/OrdersStoreType';

const makeOrder = (patch: Partial<Order>): Order =>
  ({
    id: 909,
    is_get: 1,
    is_my: 1,
    number: '79995553322',
    status_order: 6,
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

test.each([
  { status_order: 6, is_get: 1 },
  { status_order: 6, is_get: 0 },
  { status_order: 6, is_get: undefined },
  { status_order: '6', is_get: '0' },
])('закрытый заказ %p: все action-кнопки скрыты, телефон виден', async patch => {
  const item = makeOrder(patch as Partial<Order>);
  const dialCall = jest.fn();
  const actionButtonOrder = jest.fn();
  const setActiveConfirm = jest.fn();
  await render(
    <OrderActions
      item={item}
      dialCall={dialCall}
      setActiveConfirm={setActiveConfirm}
      actionButtonOrder={actionButtonOrder}
      globalFontSize={16}
    />
  );

  // Телефонная кнопка доступна по стабильному testID
  expect(screen.getByTestId(`order-${item.id}-phone`)).toHaveStyle({
    borderWidth: 1,
    borderColor: 'rgba(66, 98, 125, 0.16)',
  });

  // Экшены скрыты
  expect(screen.queryByTestId(`order-${item.id}-cancel`)).toBeNull();
  expect(screen.queryByTestId(`order-${item.id}-finish`)).toBeNull();
  expect(screen.queryByTestId(`order-${item.id}-fake`)).toBeNull();
  expect(screen.queryByTestId(`order-${item.id}-qr`)).toBeNull();

  // И «Взять» тут быть не должно
  expect(screen.queryByTestId(`order-${item.id}-take`)).toBeNull();
  await fireEvent.press(screen.getByTestId(`order-${item.id}-phone`));
  expect(dialCall).toHaveBeenCalledWith(item.number);
  expect(actionButtonOrder).not.toHaveBeenCalled();
  expect(setActiveConfirm).not.toHaveBeenCalled();
});
