/**
 * Назначение:
 *   Ветка «у другого курьера»:
 *   • показываются driver_name/driver_login
 *   • клик по логину вызывает dialCall(number)
 *   • action-кнопок нет
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OrderActions } from '@/entities/CardOrder/ui/OrderActions';
import type { Order } from '@/shared/store/OrdersStoreType';

const mkOrder = (p: Partial<Order>): Order => ({
  id: 202,
  is_get: 1, is_my: 0,
  number: '79991112233',
  status_order: 0, online_pay: 0, is_delete: 0,
  driver_name: 'Иван Петров', driver_login: 'ivanp',
  addr: 'Адрес', pd: '1', et: '', kv: '',
  ...p,
} as Order);

test('у другого курьера: имя/логин видны; клик по логину -> dialCall(number); action-кнопок нет', () => {
  const item = mkOrder({});
  const dialCall = jest.fn();

  render(
    <OrderActions
      item={item}
      dialCall={dialCall}
      setActiveConfirm={jest.fn()}
      actionButtonOrder={jest.fn()}
      globalFontSize={16}
    />
  );

  // Видимость по testID
  expect(screen.getByTestId(`order-${item.id}-other-name`)).toBeTruthy();
  const loginBtn = screen.getByTestId(`order-${item.id}-other-login`);
  expect(loginBtn).toBeTruthy();

  // Клик по логину вызывает звонок
  fireEvent.press(loginBtn);
  expect(dialCall).toHaveBeenCalledWith(item.number);

  // Action-кнопок нет
  expect(screen.queryByTestId(`order-${item.id}-take`)).toBeNull();
  expect(screen.queryByTestId(`order-${item.id}-cancel`)).toBeNull();
  expect(screen.queryByTestId(`order-${item.id}-finish`)).toBeNull();
  expect(screen.queryByTestId(`order-${item.id}-fake`)).toBeNull();
});
