import React from 'react'
import { render } from '@testing-library/react-native'

import type { Order } from '@/shared/store/OrdersStoreType'

jest.mock('@/entities/CardOrder/ui/OrderActions', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    OrderActions: () => React.createElement(View, { testID: 'order-actions' }),
  }
})

import { CardOrder } from '@/entities/CardOrder/ui/CardOrder'
import { CardTag } from '@/entities/CardOrder/ui/CardTag'

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 169126,
    id_text: '#169126 В очереди 0%',
    is_get: 0,
    is_my: 0,
    is_delete: 0,
    status_order: 1,
    online_pay: 0,
    addr: 'Физкультурная улица, 23',
    pd: '3',
    et: '5',
    kv: '60',
    need_time: '17:00 - 17:30',
    time_start_order: '16:05',
    close_date_time_order: '',
    to_time: '01:15',
    count_other: 1,
    count_pasta: 2,
    count_pizza: 1,
    count_drink: 0,
    comment: '',
    delete_reason: '',
    sdacha: 0,
    sum_sdacha: 0,
    sum_order: 1500,
    number: '79990000000',
    driver_name: '',
    driver_login: '',
    fake_dom: 1,
    ...overrides,
  } as Order
}

const commonProps = {
  FormatPrice: (value: number) => String(value),
  showAlertText: jest.fn(),
  globalFontSize: 16,
  dialCall: jest.fn(),
  actionButtonOrder: jest.fn(),
  setActiveConfirm: jest.fn(),
}

describe('визуальная структура карточки заказа', () => {
  it('использует поверхность сайта и показывает основные данные и теги', async () => {
    const screen = await render(
      <CardOrder item={createOrder()} {...commonProps} />,
    )

    expect(screen.getByTestId('order-card')).toHaveStyle({
      marginHorizontal: 20,
      marginTop: 16,
      padding: 16,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
    })
    expect(screen.getByTestId('order-card-title')).toHaveTextContent(
      '#169126 В очереди 0%',
    )
    expect(screen.getByTestId('order-address')).toHaveTextContent(
      'Адрес: Физкультурная улица, 23',
    )
    expect(screen.getByTestId('order-tag-blue')).toHaveStyle({
      backgroundColor: '#2196F3',
    })
    expect(screen.getByTestId('order-tag-purpur')).toHaveStyle({
      backgroundColor: '#9C27B0',
    })
    expect(screen.getByTestId('order-tag-red')).toHaveStyle({
      backgroundColor: '#F44336',
    })
    expect(screen.getByTestId('order-actions')).toBeTruthy()
  })

  it('показывает отменённый заказ на тёмно-красном фоне с причиной', async () => {
    const screen = await render(
      <CardOrder
        item={createOrder({
          is_delete: 1,
          delete_reason: 'Клиент отменил заказ',
        })}
        {...commonProps}
      />,
    )

    expect(screen.getByTestId('order-card')).toHaveStyle({
      backgroundColor: '#D95030',
    })
    expect(screen.getByTestId('order-delete-reason')).toHaveTextContent(
      'Причина удаления: Клиент отменил заказ',
    )
  })

  it('нормализует строковые флаги legacy API', async () => {
    const screen = await render(
      <CardOrder
        item={createOrder({
          is_delete: '1' as unknown as number,
          online_pay: '1' as unknown as number,
          fake_dom: '0' as unknown as number,
          sdacha: '1000' as unknown as number,
          delete_reason: 'Клиент отменил заказ',
        })}
        {...commonProps}
      />,
    )

    expect(screen.getByTestId('order-card')).toHaveStyle({
      backgroundColor: '#D95030',
    })
    expect(screen.getByTestId('order-intercom')).toBeTruthy()
    expect(screen.getByTestId('order-price-paid')).toHaveTextContent('Оплачено')
    expect(screen.queryByTestId('order-price-sdacha')).toBeNull()
  })

  it('использует зелёный цвет тега напитков', async () => {
    const screen = await render(
      <CardTag
        color="green"
        count={2}
        globalFontSize={16}
        text="Напиток"
      />,
    )

    expect(screen.getByTestId('order-tag-green')).toHaveStyle({
      backgroundColor: '#4CAF50',
    })
    expect(screen.getByText('Напиток x2')).toBeTruthy()
  })
})
