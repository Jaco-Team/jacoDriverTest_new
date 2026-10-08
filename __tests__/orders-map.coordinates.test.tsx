import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

let mockListOrdersState: any

jest.mock('@/features/orders-map/model/useListOrdersLogic', () => ({
  useListOrdersLogic: () => mockListOrdersState,
}))

jest.mock('@/features/orders-map/ui/OrderMarker', () => {
  const React = require('react')
  const { Pressable } = require('react-native')

  return {
    OrderMarker: ({ item, showOrdersMap, groupCount, statusColors }: any) =>
      React.createElement(Pressable, {
        testID: `orders-map-order-${item.id}`,
        accessibilityLabel: `${groupCount}:${statusColors.join(',')}`,
        onPress: () => showOrdersMap(item.id),
      }),
  }
})

import { isValidMapPoint } from '@/features/orders-map/model/mapPoint'
import { ListOrders } from '@/features/orders-map/ui/ListOrders'

describe('координаты маркеров карты заказов', () => {
  beforeEach(() => {
    mockListOrdersState = {
      orders: [],
      showOrdersMap: jest.fn(),
      globalFontSize: 16,
      mapScale: 1,
      theme: 'white',
      preferDriverColor: false,
    }
  })

  it('принимает только конечные координаты в диапазоне MapKit', () => {
    expect(isValidMapPoint({ lat: 0, lon: 0 })).toBe(true)
    expect(isValidMapPoint({ lat: -90, lon: 180 })).toBe(true)
    expect(isValidMapPoint({ lat: Number.NaN, lon: 50 })).toBe(false)
    expect(isValidMapPoint({ lat: 53, lon: Number.POSITIVE_INFINITY })).toBe(false)
    expect(isValidMapPoint({ lat: 91, lon: 50 })).toBe(false)
    expect(isValidMapPoint({ lat: 53, lon: -181 })).toBe(false)
    expect(isValidMapPoint({ lat: '53', lon: '50' })).toBe(false)
  })

  it('не монтирует на карте заказы с некорректными координатами', async () => {
    mockListOrdersState.orders = [
      { id: 1, to_time_sec_min: 1, xy: { lat: 53.2, lon: 50.1 } },
      { id: 2, to_time_sec_min: 1, xy: { lat: Number.NaN, lon: 50.1 } },
      { id: 3, to_time_sec_min: 1, xy: { lat: 53.2, lon: 181 } },
    ]

    const screen = await render(<ListOrders />)

    expect(screen.getByTestId('orders-map-order-1')).toBeTruthy()
    expect(screen.queryByTestId('orders-map-order-2')).toBeNull()
    expect(screen.queryByTestId('orders-map-order-3')).toBeNull()
  })

  it('открывает сохранённый заказ нажатием на маркер без запроса к API', async () => {
    mockListOrdersState.orders = [
      { id: 1, to_time_sec_min: 1, xy: { lat: 53.2, lon: 50.1 } },
    ]

    const screen = await render(<ListOrders />)
    fireEvent.press(screen.getByTestId('orders-map-order-1'))

    expect(mockListOrdersState.showOrdersMap).toHaveBeenCalledWith(1)
  })

  it('рисует одну общую метку для заказов с одинаковыми координатами', async () => {
    mockListOrdersState.orders = [
      {
        id: 1,
        to_time_sec_min: 1,
        point_color: '#00aa00',
        xy: { lat: 53.5321, lon: 49.3214 },
      },
      {
        id: 2,
        to_time_sec_min: 2,
        point_color: '#cc0033',
        xy: { lat: 53.532101, lon: 49.321401 },
      },
      {
        id: 3,
        to_time_sec_min: 3,
        point_color: '#0088cc',
        xy: { lat: 53.54, lon: 49.33 },
      },
    ]

    const screen = await render(<ListOrders />)

    expect(screen.getByTestId('orders-map-order-1').props.accessibilityLabel).toBe(
      '2:#00aa00,#cc0033',
    )
    expect(screen.queryByTestId('orders-map-order-2')).toBeNull()
    expect(screen.getByTestId('orders-map-order-3')).toBeTruthy()

    fireEvent.press(screen.getByTestId('orders-map-order-1'))
    expect(mockListOrdersState.showOrdersMap).toHaveBeenCalledWith(1)
  })
})
