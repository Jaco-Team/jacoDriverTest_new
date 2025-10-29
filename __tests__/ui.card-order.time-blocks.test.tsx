// __tests__/ui.card-order.time-blocks.test.tsx
/**
 * Назначение:
 *   Проверяем отображение временных блоков по статусу заказа.
 *
 * Что покрываем:
 *   • status_order=1 → «Начнут готовить» и «Осталось»
 *   • status_order=6 → «Отдали»
 *   • иначе          → только «Осталось»
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CardOrder } from '@/entities/CardOrder/ui/CardOrder';
import type { Order } from '@/shared/store/OrdersStoreType';

const baseItem: Partial<Order> = {
  id: 10,
  id_text: 'ORD-10',
  is_get: 1, is_my: 1,
  status_order: 0,
  online_pay: 0, is_delete: 0,
  addr: 'Адрес',
  pd: '1', et: '', kv: '',
  need_time: '12:30',
  time_start_order: '12:00',
  close_date_time_order: '13:00',
  to_time: '00:20',
  count_other: 0, count_pasta: 0, count_pizza: 0, count_drink: 0,
  comment: '',
  sdacha: 0, sum_sdacha: 0, sum_order: 100,
  number: '79990000000',
  driver_name: '', driver_login: '',
  fake_dom: 1,
};

const commonProps = {
  FormatPrice: (n: number) => `${n}`,
  showAlertText: jest.fn(),
  globalFontSize: 16,
  dialCall: jest.fn(),
  actionButtonOrder: jest.fn(),
  setActiveConfirm: jest.fn(),
};

test('status_order=1: видны «Начнут готовить» и «Осталось», нет «Отдали»', () => {
  const item = { ...baseItem, status_order: 1 } as Order;
  render(<CardOrder item={item} {...commonProps} />);

  expect(screen.getByTestId('order-time-start')).toBeTruthy();
  expect(screen.getByTestId('order-time-left')).toBeTruthy();
  expect(screen.queryByTestId('order-time-close')).toBeNull();
});

test('status_order=6: виден «Отдали», скрыты «Начнут готовить» и «Осталось»', () => {
  const item = { ...baseItem, status_order: 6 } as Order;
  render(<CardOrder item={item} {...commonProps} />);

  expect(screen.getByTestId('order-time-close')).toBeTruthy();
  expect(screen.queryByTestId('order-time-start')).toBeNull();
  expect(screen.queryByTestId('order-time-left')).toBeNull();
});

test('status_order=0 (прочее): виден «Осталось», скрыты «Начнут готовить» и «Отдали»', () => {
  const item = { ...baseItem, status_order: 0 } as Order;
  render(<CardOrder item={item} {...commonProps} />);

  expect(screen.getByTestId('order-time-left')).toBeTruthy();
  expect(screen.queryByTestId('order-time-start')).toBeNull();
  expect(screen.queryByTestId('order-time-close')).toBeNull();
});
