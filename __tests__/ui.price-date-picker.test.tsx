import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

jest.mock('@/components/ui/actionsheet', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    Actionsheet: ({ children, isOpen, snapPoints }: any) =>
      isOpen
        ? React.createElement(
          View,
          { snapPoints, testID: 'mock-date-actionsheet' },
          children,
        )
        : null,
    ActionsheetBackdrop: View,
    ActionsheetContent: View,
    ActionsheetDragIndicator: View,
    ActionsheetDragIndicatorWrapper: View,
  }
})

import { PriceDatePickerSheet } from '@/features/salary/ui/PriceDatePickerSheet'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

describe('календарная шторка расчёта', () => {
  it('учитывает Safe Area, диапазон и возвращает выбранную дату', async () => {
    const onSelect = jest.fn()

    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PriceDatePickerSheet
          isOpen
          maxDate="2026-08-30"
          minDate="2026-08-10"
          title="Дата от"
          value="2026-08-20"
          onClose={jest.fn()}
          onSelect={onSelect}
        />
      </SafeAreaProvider>,
    )

    expect(screen.getByTestId('price-date-picker-sheet')).toHaveStyle({
      maxHeight: '75%',
      paddingBottom: 46,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
    })
    expect(screen.getByTestId('price-date-picker-title')).toHaveTextContent('Дата от')
    expect(screen.getByText('Август 2026')).toBeTruthy()
    expect(screen.getByTestId('price-date-2026-08-09')).toBeDisabled()
    const firstWeek = screen.getByTestId('price-date-picker-week-0')
    expect(firstWeek.children).toHaveLength(7)
    expect(within(firstWeek).getByTestId('price-date-2026-08-02')).toBeTruthy()
    expect(
      screen.getByTestId('price-date-2026-08-20').props.accessibilityState,
    ).toEqual({ disabled: false, selected: true })

    await fireEvent.press(screen.getByTestId('price-date-2026-08-25'))

    expect(onSelect).toHaveBeenCalledWith('2026-08-25')
  })

  it('не рендерится в закрытом состоянии', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PriceDatePickerSheet
          isOpen={false}
          maxDate="2026-08-30"
          minDate="2026-08-10"
          title=""
          value="2026-08-20"
          onClose={jest.fn()}
          onSelect={jest.fn()}
        />
      </SafeAreaProvider>,
    )

    expect(screen.queryByTestId('price-date-picker-sheet')).toBeNull()
  })

  it('задаёт стабильную стартовую высоту Android до первого layout', async () => {
    const initialPlatform = Platform.OS
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })

    try {
      await render(
        <SafeAreaProvider initialMetrics={metrics}>
          <PriceDatePickerSheet
            isOpen
            maxDate="2026-08-30"
            minDate="2026-08-10"
            title="Дата до"
            value="2026-08-30"
            onClose={jest.fn()}
            onSelect={jest.fn()}
          />
        </SafeAreaProvider>,
      )

      const [snapPoint] = screen.getByTestId('mock-date-actionsheet').props.snapPoints
      expect(snapPoint).toBeGreaterThan(0)
      expect(snapPoint).toBeLessThanOrEqual(75)
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: initialPlatform,
      })
    }
  })
})
