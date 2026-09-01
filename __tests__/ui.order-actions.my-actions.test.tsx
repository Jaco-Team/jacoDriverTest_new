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

test('мой заказ: cancel/finish/fake → корректные setActiveConfirm', async () => {
  const item = makeOrder({});
  const setActiveConfirm = jest.fn();
  const dialCall = jest.fn();

  await render(
    <OrderActions
      item={item}
      dialCall={dialCall}
      setActiveConfirm={setActiveConfirm}
      actionButtonOrder={jest.fn()}
      globalFontSize={16}
    />
  );

  await fireEvent.press(screen.getByTestId(`order-${item.id}-cancel`));
  expect(setActiveConfirm).toHaveBeenCalledWith(true, item.id, 'cancel', false);

  await fireEvent.press(screen.getByTestId(`order-${item.id}-finish`));
  expect(setActiveConfirm).toHaveBeenCalledWith(true, item.id, 'finish', false);

  await fireEvent.press(screen.getByTestId(`order-${item.id}-fake`));
  expect(setActiveConfirm).toHaveBeenCalledWith(true, item.id, 'fake', false);

  expect(setActiveConfirm).toHaveBeenCalledTimes(3);

  const phoneButton = screen.getByTestId(`order-${item.id}-phone`);
  expect(phoneButton).toHaveStyle({
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  });
  expect(screen.getByText(item.number)).toHaveStyle({
    color: '#1F2D38',
    fontSize: 14,
  });
  await fireEvent.press(phoneButton);
  expect(dialCall).toHaveBeenCalledWith(item.number);
});

test('при online_pay=0 рядом с «Завершить» есть кнопка QR', async () => {
  const item = makeOrder({ online_pay: 0 });
  await render(
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
  expect(screen.getByText('ОТМЕНИТЬ')).toBeTruthy();
  expect(screen.getByText('ЗАВЕРШИТЬ')).toBeTruthy();
  expect(screen.getByText('КЛИЕНТ НЕ ВЫШЕЛ НА СВЯЗЬ')).toBeTruthy();
  expect(screen.getByTestId(`order-${item.id}-qr`)).toHaveStyle({
    height: 44,
    minWidth: 44,
    borderRadius: 8,
    backgroundColor: '#9C27B0',
  });
});

test('строковые флаги legacy API сохраняют действия моего заказа', async () => {
  const item = makeOrder({
    is_get: '1' as unknown as number,
    is_my: '1' as unknown as number,
    online_pay: '0' as unknown as number,
    status_order: '0' as unknown as number,
    is_delete: '1' as unknown as number,
  });
  const setActiveConfirm = jest.fn();

  await render(
    <OrderActions
      item={item}
      dialCall={jest.fn()}
      setActiveConfirm={setActiveConfirm}
      actionButtonOrder={jest.fn()}
      globalFontSize={16}
    />
  );

  expect(screen.getByTestId(`order-${item.id}-qr`)).toBeTruthy();
  await fireEvent.press(screen.getByTestId(`order-${item.id}-finish`));
  expect(setActiveConfirm).toHaveBeenCalledWith(
    true,
    item.id,
    'finish',
    true,
  );
});
