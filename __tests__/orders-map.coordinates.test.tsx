import React from 'react'
import { render } from '@testing-library/react-native'

let mockListOrdersState: any

jest.mock('@/features/orders-map/model/useListOrdersLogic', () => ({
  useListOrdersLogic: () => mockListOrdersState,
}))

jest.mock('@/features/orders-map/ui/OrderMarker', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    OrderMarker: ({ item }: any) =>
      React.createElement(View, { testID: `orders-map-order-${item.id}` }),
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
})
