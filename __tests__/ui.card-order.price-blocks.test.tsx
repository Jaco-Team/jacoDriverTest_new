// __tests__/ui.card-order.price-blocks.test.tsx
/**
 * Назначение:
 *   Проверяем денежные блоки карточки:
 *   • online_pay=1 → вместо числа показывается «Оплачено», блок «Сдача с:» скрыт
 *   • online_pay=0 + sdacha>0 → рендерится «Сдача с: … ( … )»
 *   • online_pay=0 + sdacha=0 → «Сдача с:» скрыт
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CardOrder } from '@/entities/CardOrder/ui/CardOrder';
import type { Order } from '@/shared/store/OrdersStoreType';

const mkItem = (p: Partial<Order> = {}): Order => ({
  id: 7, id_text: 'ORD-7',
  is_get: 1, is_my: 1,
  status_order: 0, online_pay: 0, is_delete: 0,
  addr: 'Адрес', pd: '1', et: '', kv: '',
  need_time: '12:30', time_start_order: '12:00', close_date_time_order: '13:00', to_time: '00:20',
  count_other: 0, count_pasta: 0, count_pizza: 0, count_drink: 0,
  comment: '', sdacha: 0, sum_sdacha: 0, sum_order: 500,
  number: '79990000000', driver_name: '', driver_login: '', fake_dom: 1,
  ...p,
} as Order);

const common = {
  FormatPrice: (n: number) => `${n}`,
  showAlertText: jest.fn(),
  globalFontSize: 16,
  dialCall: jest.fn(),
  actionButtonOrder: jest.fn(),
  setActiveConfirm: jest.fn(),
};

test('online_pay=1: показывается «Оплачено», «Сдача с:» скрыт', () => {
  const item = mkItem({ online_pay: 1, sdacha: 100, sum_sdacha: 50 });
  render(<CardOrder item={item} {...common} />);

  // Есть блок суммы и метка "Оплачено"
  expect(screen.getByTestId('order-price-sum')).toBeTruthy();
  expect(screen.getByTestId('order-price-paid')).toBeTruthy();

  // Числового значения суммы нет
  expect(screen.queryByTestId('order-price-sum-value')).toBeNull();

  // Сдача полностью скрыта
  expect(screen.queryByTestId('order-price-sdacha')).toBeNull();
});

test('online_pay=0 + sdacha>0: показывается «Сдача с:» с данными', () => {
  const item = mkItem({ online_pay: 0, sdacha: 1000, sum_sdacha: 500 });
  render(<CardOrder item={item} {...common} />);

  // Видны и сумма, и её числовое значение
  expect(screen.getByTestId('order-price-sum')).toBeTruthy();
  expect(screen.getByTestId('order-price-sum-value')).toBeTruthy();

  // Блок сдачи присутствует
  expect(screen.getByTestId('order-price-sdacha')).toBeTruthy();
  expect(screen.getByTestId('order-price-sdacha-value')).toBeTruthy();
});

test('online_pay=0 + sdacha=0: «Сдача с:» скрыт', () => {
  const item = mkItem({ online_pay: 0, sdacha: 0, sum_sdacha: 0 });
  render(<CardOrder item={item} {...common} />);

  expect(screen.getByTestId('order-price-sum')).toBeTruthy();
  expect(screen.getByTestId('order-price-sum-value')).toBeTruthy();
  expect(screen.queryByTestId('order-price-sdacha')).toBeNull();
});
