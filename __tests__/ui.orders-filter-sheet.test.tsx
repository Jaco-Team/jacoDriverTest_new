import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const mockShowModalTypeDop = jest.fn()
const mockSetTypeDop = jest.fn()
let mockFilterLogic: any

jest.mock('@/features/orders-map/model/useModalOrderLogic', () => ({
  useModalFilterOrdersLogic: () => mockFilterLogic,
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

jest.mock('lucide-react-native', () => {
  const React = require('react')
  const { View } = require('react-native')
  const Check = (props: any) =>
    React.createElement(View, { ...props, testID: 'filter-check' })

  return { Check }
})

import { ModalFilterOrders } from '@/features/orders-map/ui/ModalFilterOrders'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

async function renderFilter(): Promise<void> {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ModalFilterOrders />
    </SafeAreaProvider>,
  )
}

describe('фильтр активных заказов', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFilterLogic = {
      globalFontSize: 16,
      types_dop: [
        { id: 1, text: 'В очереди' },
        { id: 2, text: 'Готовится' },
        { id: 3, text: 'Собран' },
      ],
      type_dop: ['1', '2'],
      is_showModalTypeDop: true,
      showModalTypeDop: mockShowModalTypeDop,
      setTypeDop: mockSetTypeDop,
    }
  })

  it('показывает шторку и состояния кнопок по сайту', async () => {
    await renderFilter()

    expect(screen.getByText('Активные заказы')).toBeTruthy()
    expect(screen.getByText('Какие статусы показывать')).toBeTruthy()
    expect(screen.getByText('Активные заказы')).toHaveStyle({
      width: '100%',
      textAlign: 'left',
    })
    expect(screen.getByText('Какие статусы показывать')).toHaveStyle({
      width: '100%',
      textAlign: 'left',
    })
    expect(screen.getByTestId('orders-filter-sheet')).toHaveStyle({
      maxHeight: '75%',
      paddingHorizontal: 20,
      paddingBottom: 62,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: '#FFFFFF',
    })
    expect(screen.getByTestId('orders-filter-option-1')).toHaveStyle({
      height: 44,
      borderRadius: 12,
      backgroundColor: '#CC0033',
    })
    expect(screen.getByTestId('orders-filter-option-3')).toHaveStyle({
      height: 44,
      borderRadius: 12,
      backgroundColor: '#E9EEF3',
    })
    expect(screen.getAllByTestId('filter-check')).toHaveLength(2)
  })

  it('добавляет и убирает статус через существующий setTypeDop', async () => {
    await renderFilter()

    await fireEvent.press(screen.getByTestId('orders-filter-option-1'))
    expect(mockSetTypeDop).toHaveBeenCalledWith(['2'])

    await fireEvent.press(screen.getByTestId('orders-filter-option-3'))
    expect(mockSetTypeDop).toHaveBeenCalledWith(['1', '2', '3'])
  })

  it('закрывается через индикатор тем же store-действием', async () => {
    await renderFilter()

    await fireEvent.press(screen.getByTestId('orders-filter-sheet-handle'))
    expect(mockShowModalTypeDop).toHaveBeenCalledWith(false)
  })

  it('не рендерит шторку при закрытом состоянии', async () => {
    mockFilterLogic.is_showModalTypeDop = false
    await renderFilter()

    expect(screen.queryByTestId('orders-filter-sheet')).toBeNull()
  })
})
