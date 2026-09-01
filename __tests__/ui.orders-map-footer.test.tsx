import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const mockSelectType = jest.fn()

jest.mock('@/features/orders-map/model/useLimitLogic', () => ({
  useLimitLogic: () => ({
    limit_summ: '0 / 4',
    limit_count: '0 / 20000',
    selectType: mockSelectType,
    type: { id: 1, text: 'Активные' },
    globalFontSize: 16,
    night_map: 0,
  }),
}))

import { TypeLimit } from '@/features/orders-map/ui/Limit'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

describe('нижняя панель карты', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('показывает раздельные лимиты и три типа без кнопки обновления', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <TypeLimit />
      </SafeAreaProvider>,
    )

    expect(screen.getByTestId('orders-map-limit-sum')).toHaveTextContent('0 / 4')
    expect(screen.getByTestId('orders-map-limit-count')).toHaveTextContent('0 / 20000')
    expect(screen.getByTestId('orders-map-limits')).toHaveStyle({ bottom: 110 })
    expect(screen.getByTestId('orders-map-type-bar')).toHaveStyle({ bottom: 46 })
    expect(screen.getByTestId('orders-map-type-active')).toBeTruthy()
    expect(screen.getByTestId('orders-map-type-mine')).toBeTruthy()
    expect(screen.getByTestId('orders-map-type-other')).toBeTruthy()
    expect(screen.getByText('АКТИВНЫЕ')).toBeTruthy()
    expect(screen.getByText('МОИ')).toBeTruthy()
    expect(screen.getByText('У ДРУГИХ')).toBeTruthy()
    expect(screen.queryByLabelText('Обновить заказы')).toBeNull()
  })

  it('сохраняет существующие значения типов при выборе', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <TypeLimit />
      </SafeAreaProvider>,
    )

    await fireEvent.press(screen.getByTestId('orders-map-type-active'))
    await fireEvent.press(screen.getByTestId('orders-map-type-mine'))
    await fireEvent.press(screen.getByTestId('orders-map-type-other'))

    expect(mockSelectType).toHaveBeenNthCalledWith(1, { id: 1, text: 'Активные' })
    expect(mockSelectType).toHaveBeenNthCalledWith(2, { id: 2, text: 'Мои отмеченные' })
    expect(mockSelectType).toHaveBeenNthCalledWith(3, { id: 5, text: 'У других курьеров' })
  })
})
