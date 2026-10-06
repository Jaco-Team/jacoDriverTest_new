import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { CardOrder } from '@/entities/CardOrder/ui/CardOrder'
import type { Order } from '@/shared/store/OrdersStoreType'

const finishedOrder = {
  id: 446295,
  id_text: '#446295',
  status_order: 6,
  is_my: 1,
  is_get: 0,
  addr: '',
  street: 'Тестовая улица',
  home: '12А',
  pd: '1', et: '2', kv: '15',
  close_date_time_order: '11:09:20',
  need_time: '10:49 - 11:49',
  online_pay: 1,
  sdacha: 0,
  sum_order: 100,
  number: '79990000000',
  fake_dom: 1,
  count_other: 0, count_pizza: 0, count_pasta: 0, count_drink: 0,
  comment: '',
} as Order

const props = {
  FormatPrice: (price: number) => String(price),
  showAlertText: jest.fn(),
  globalFontSize: 16,
  dialCall: jest.fn(),
  actionButtonOrder: jest.fn(),
  setActiveConfirm: jest.fn(),
}

test.each(['', null, undefined, '   '])(
  'завершённый заказ с addr=%p показывает улицу и дом без кнопки «Взять»',
  async addr => {
    const item = { ...finishedOrder, addr } as Order
    await render(<CardOrder item={item} {...props} />)

    expect(screen.getByTestId('order-address')).toHaveTextContent(
      'Адрес: Тестовая улица, 12А',
    )
    expect(screen.getByTestId('order-time-close')).toHaveTextContent('Отдали: 11:09:20')
    expect(screen.queryByTestId(`order-${item.id}-take`)).toBeNull()
  },
)

test('готовый адрес имеет приоритет над отдельными полями улицы и дома', async () => {
  const item = { ...finishedOrder, addr: 'Другая улица, 7' }
  await render(<CardOrder item={item} {...props} />)

  expect(screen.getByTestId('order-address')).toHaveTextContent('Адрес: Другая улица, 7')
})
