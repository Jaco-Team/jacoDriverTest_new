import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

const mockSelectType = jest.fn()

let mockGlobalState: any
let mockOrdersState: any

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}))

jest.mock('@/shared/store/store', () => ({
  useGlobalStore: (selector: any) => selector(mockGlobalState),
  useOrdersStore: (selector: any) => selector(mockOrdersState),
}))

jest.mock('@/components/ui/actionsheet', () => {
  const React = require('react')
  const { Pressable, Text, View } = require('react-native')

  return {
    Actionsheet: ({ children, isOpen }: any) => (
      isOpen ? React.createElement(View, null, children) : null
    ),
    ActionsheetBackdrop: View,
    ActionsheetContent: View,
    ActionsheetDragIndicator: View,
    ActionsheetDragIndicatorWrapper: View,
    ActionsheetItem: Pressable,
    ActionsheetItemText: Text,
  }
})

import { TypeLimit } from '@/features/orders-list/ui/TypeLimit'

describe('шапка списка заказов', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGlobalState = {
      globalFontSize: 16,
    }
    mockOrdersState = {
      getOrders: jest.fn(),
      limit_summ: '0 / 20000',
      limit_count: '0 / 4',
      type: { id: 1, text: 'Активные' },
      types: [
        { id: 1, text: 'Активные' },
        { id: 3, text: 'Предзаказы' },
        { id: 2, text: 'Мои отмеченные' },
        { id: 5, text: 'У других курьеров' },
        { id: 6, text: 'Мои завершенные' },
      ],
      selectType: mockSelectType,
    }
  })

  it('показывает тип, счётчик и лимит', async () => {
    const screen = await render(<TypeLimit />)

    expect(screen.getByText('АКТИВНЫЕ')).toBeTruthy()
    expect(screen.getByTestId('orders-list-limit-count').props.children)
      .toBe('0 / 4')
    expect(screen.getByTestId('orders-list-limit-sum').props.children)
      .toBe('0 / 20000')
  })

  it('открывает селектор, отмечает текущий тип и закрывается после выбора', async () => {
    const screen = await render(<TypeLimit />)

    expect(screen.queryByTestId('orders-status-sheet')).toBeNull()
    await fireEvent.press(screen.getByTestId('orders-status-trigger'))

    expect(screen.getByText('Список заказов')).toBeTruthy()
    expect(screen.getByText('Мои отмеченные')).toBeTruthy()
    expect(screen.getByText('У других курьеров')).toBeTruthy()
    expect(screen.getByText('Мои завершенные')).toBeTruthy()
    expect(
      screen.getByTestId('orders-status-option-1').props.accessibilityState,
    ).toEqual({ selected: true })

    await fireEvent.press(screen.getByTestId('orders-status-option-3'))

    expect(mockSelectType).toHaveBeenCalledWith({
      id: 3,
      text: 'Предзаказы',
    })
    expect(screen.queryByTestId('orders-status-sheet')).toBeNull()
  })

  it('закрывает селектор без изменения типа', async () => {
    const screen = await render(<TypeLimit />)

    await fireEvent.press(screen.getByTestId('orders-status-trigger'))
    await fireEvent.press(screen.getByTestId('orders-status-close'))

    expect(mockSelectType).not.toHaveBeenCalled()
    expect(screen.queryByTestId('orders-status-sheet')).toBeNull()
  })
})
