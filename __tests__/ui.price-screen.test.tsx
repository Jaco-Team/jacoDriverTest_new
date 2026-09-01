import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const mockOpenStartPicker = jest.fn()
const mockOpenEndPicker = jest.fn()

jest.mock('@/features/salary/model/usePriceScreen', () => ({
  usePriceScreen: () => ({
    activePicker: null,
    closePicker: jest.fn(),
    globalFontSize: 16,
    openEndPicker: mockOpenEndPicker,
    openStartPicker: mockOpenStartPicker,
    pickerMaxDate: '2026-08-30',
    pickerMinDate: '2026-05-29',
    pickerTitle: '',
    pickerValue: '2026-08-30',
    selectPickerDate: jest.fn(),
    settlementRows: [
      { label: '12:15', value: '500 ₽' },
      { label: 'Всего сдал', value: '500 ₽', emphasize: true },
      { label: 'Осталось сдать', value: '700 ₽', emphasize: true, hideDivider: true },
    ],
    showDateEnd: '30 августа 2026',
    showDateStart: '29 августа 2026',
    summaryRows: [
      {
        label: 'Сумма налички',
        value: '1 500 ₽',
        description: 'Подсказка налички',
      },
      {
        label: 'Заработал',
        value: '700 ₽',
        emphasize: true,
        hideDivider: true,
      },
    ],
    totalPriceFontSize: 48,
    totalPriceLabel: '700 ₽',
  }),
}))

jest.mock('@/features/salary/ui/TextPopover', () => ({
  TextPopover: ({ Main }: any) => Main,
}))

jest.mock('@/components/ui/actionsheet', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    Actionsheet: ({ children, isOpen }: any) =>
      isOpen ? React.createElement(View, null, children) : null,
    ActionsheetBackdrop: View,
    ActionsheetContent: View,
    ActionsheetDragIndicator: View,
    ActionsheetDragIndicatorWrapper: View,
  }
})

import { PriceScreen } from '@/features/salary/ui/PriceScreen'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

describe('страница расчёта', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('показывает композицию, диапазон и показатели актуального сайта', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PriceScreen />
      </SafeAreaProvider>,
    )

    expect(screen.getByTestId('price-screen')).toHaveStyle({
      flex: 1,
      backgroundColor: '#F4F7FA',
    })
    expect(screen.getByText('Расчет')).toBeTruthy()
    expect(screen.getByTestId('price-range-card')).toHaveStyle({
      borderRadius: 24,
      backgroundColor: '#FFFFFF',
    })
    expect(screen.getByText('С')).toBeTruthy()
    expect(screen.getByText('по')).toBeTruthy()
    expect(screen.getByText('29 августа 2026')).toBeTruthy()
    expect(screen.getByText('30 августа 2026')).toBeTruthy()
    expect(screen.getByTestId('price-total')).toHaveTextContent('700 ₽')
    expect(screen.getByTestId('price-metric-Сумма налички')).toHaveTextContent(
      'Сумма налички1 500 ₽',
    )
    expect(screen.getByTestId('price-metric-Заработал')).toHaveTextContent(
      'Заработал700 ₽',
    )
    expect(screen.getByTestId('price-metric-12:15')).toHaveTextContent('12:15500 ₽')
    expect(screen.queryByText('Время')).toBeNull()
    expect(screen.queryByText('Сданная сумма')).toBeNull()
  })

  it('открывает нужный календарь из единого диапазона', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PriceScreen />
      </SafeAreaProvider>,
    )

    await fireEvent.press(screen.getByTestId('price-start-date'))
    await fireEvent.press(screen.getByTestId('price-end-date'))

    expect(mockOpenStartPicker).toHaveBeenCalledTimes(1)
    expect(mockOpenEndPicker).toHaveBeenCalledTimes(1)
  })
})
