import React from 'react'
import { act, render } from '@testing-library/react-native'
import { Text } from 'react-native'

const mockCardOrder = jest.fn(({ item }: any) => (
  <Text testID={`order-card-${item.id_text}`}>{item.id_text}</Text>
))

jest.mock('@/entities/CardOrder/ui/CardOrder', () => ({
  CardOrder: (props: any) => mockCardOrder(props),
}))

jest.mock('@/features/orders-list/ui/TypeLimit', () => ({
  TypeLimit: () => {
    const React = require('react')
    const { View } = require('react-native')

    return React.createElement(View, { testID: 'orders-list-summary' })
  },
}))

import { OrdersList } from '@/features/orders-list/ui/OrdersList'

function createProps(overrides: Record<string, unknown> = {}): any {
  return {
    orders: [],
    isChecking: false,
    isGlobalLoading: false,
    getOrders: jest.fn(async () => undefined),
    FormatPrice: jest.fn((price: number) => String(price)),
    showAlertText: jest.fn(),
    globalFontSize: 16,
    dialCall: jest.fn(),
    actionButtonOrder: jest.fn(),
    setActiveConfirm: jest.fn(),
    ...overrides,
  }
}

describe('список заказов', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('показывает заголовок и пустое состояние', async () => {
    const screen = await render(<OrdersList {...createProps()} />)

    expect(screen.getByTestId('orders-list-summary')).toBeTruthy()
    expect(screen.getByTestId('orders-list-empty')).toBeTruthy()
    expect(screen.getByText('Нет заказов для отображения')).toBeTruthy()
    expect(screen.queryByTestId('orders-list-loading')).toBeNull()
  })

  it('показывает индикатор, пока идёт проверка пустого списка', async () => {
    const screen = await render(
      <OrdersList {...createProps({ isChecking: true })} />,
    )

    expect(screen.getByTestId('orders-list-loading')).toBeTruthy()
    expect(screen.queryByTestId('orders-list-empty')).toBeNull()
  })

  it('не дублирует индикатор под глобальной загрузкой', async () => {
    const screen = await render(
      <OrdersList
        {...createProps({ isChecking: true, isGlobalLoading: true })}
      />,
    )

    expect(screen.queryByTestId('orders-list-loading')).toBeNull()
    expect(screen.getByTestId('orders-list-empty')).toBeTruthy()
  })

  it('передаёт заказ в существующую карточку', async () => {
    const order = { id_text: '#169126' }
    const screen = await render(
      <OrdersList {...createProps({ orders: [order] })} />,
    )

    expect(screen.getByTestId('order-card-#169126')).toBeTruthy()
    expect(mockCardOrder.mock.calls[0][0]).toEqual(
      expect.objectContaining({ item: order }),
    )
  })

  it('обновляет список pull-to-refresh и не дублирует запрос', async () => {
    let resolveRequest: (() => void) | undefined
    const getOrders = jest.fn(() => new Promise<void>(resolve => {
      resolveRequest = resolve
    }))
    const screen = await render(
      <OrdersList {...createProps({ getOrders })} />,
    )

    const refresh = () => screen.getByTestId('orders-list')
      .props.refreshControl.props.onRefresh()

    await act(async () => {
      refresh()
    })
    expect(getOrders).toHaveBeenCalledTimes(1)

    await act(async () => {
      refresh()
    })
    expect(getOrders).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveRequest?.()
      await Promise.resolve()
    })

    expect(
      screen.getByTestId('orders-list').props.refreshControl.props.tintColor,
    ).toBe('#CC0033')
    expect(
      screen.getByTestId('orders-list').props.refreshControl.props.colors,
    ).toEqual(['#CC0033'])
  })

  it('не показывает красный индикатор между pull-to-refresh и завершением is_check', async () => {
    let resolveRequest: (() => void) | undefined
    const getOrders = jest.fn(() => new Promise<void>(resolve => {
      resolveRequest = resolve
    }))
    const props = createProps({ getOrders })
    const screen = await render(<OrdersList {...props} />)
    const refresh = () => screen.getByTestId('orders-list')
      .props.refreshControl.props.onRefresh()

    await act(async () => {
      refresh()
    })
    await screen.rerender(<OrdersList {...props} isChecking />)

    await act(async () => {
      resolveRequest?.()
      await Promise.resolve()
    })

    expect(
      screen.getByTestId('orders-list').props.refreshControl.props.refreshing,
    ).toBe(true)
    expect(screen.queryByTestId('orders-list-loading')).toBeNull()

    await screen.rerender(<OrdersList {...props} isChecking={false} />)

    expect(
      screen.getByTestId('orders-list').props.refreshControl.props.refreshing,
    ).toBe(false)
  })
})
