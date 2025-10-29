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
import { render, screen } from '@testing-library/react-native';
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

test('закрытый заказ: все action-кнопки скрыты, телефон виден', () => {
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

  // Телефонная кнопка доступна по стабильному testID
  expect(screen.getByTestId(`order-${item.id}-phone`)).toBeTruthy();

  // Экшены скрыты
  expect(screen.queryByTestId(`order-${item.id}-cancel`)).toBeNull();
  expect(screen.queryByTestId(`order-${item.id}-finish`)).toBeNull();
  expect(screen.queryByTestId(`order-${item.id}-fake`)).toBeNull();
  expect(screen.queryByTestId(`order-${item.id}-qr`)).toBeNull();

  // И «Взять» тут быть не должно
  expect(screen.queryByTestId(`order-${item.id}-take`)).toBeNull();
});
