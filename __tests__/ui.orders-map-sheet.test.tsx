import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const mockShowOrdersMap = jest.fn()
let mockLogic: any

jest.mock('@/features/orders-map/model/useModalOrderLogic', () => ({
  useModalOrderLogic: () => mockLogic,
}))

jest.mock('@/entities/CardOrder/ui/CardOrder', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    ORDER_CARD_DELETED_BG: '#D95030',
    CardOrder: ({ item }: any) =>
      React.createElement(View, {
        testID: `map-order-card-${item.id}`,
      }),
  }
})

jest.mock('@/components/ui/actionsheet', () => {
  const React = require('react')
  const { ScrollView, View } = require('react-native')

  return {
    Actionsheet: ({ children, isOpen }: any) =>
      isOpen ? React.createElement(View, null, children) : null,
    ActionsheetBackdrop: View,
    ActionsheetContent: View,
    ActionsheetDragIndicator: View,
    ActionsheetDragIndicatorWrapper: View,
    ActionsheetScrollView: ScrollView,
  }
})

import { ModalOrder } from '@/features/orders-map/ui/ModalOrder'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

async function renderSheet() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ModalOrder />
    </SafeAreaProvider>,
  )
}

describe('карточка заказа на карте', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogic = {
      FormatPrice: (value: number) => String(value),
      globalFontSize: 16,
      showAlertText: jest.fn(),
      showOrders: [{ id: 169340, is_delete: 0 }],
      isOpenOrderMap: true,
      showOrdersMap: mockShowOrdersMap,
      actionButtonOrder: jest.fn(),
      setActiveConfirm: jest.fn(),
      dialCall: jest.fn(),
      isBusy: false,
    }
  })

  it('открывается снизу, ограничена 75% и учитывает нижнюю Safe Area', async () => {
    await renderSheet()

    expect(screen.getByTestId('order-map-sheet')).toHaveStyle({
      maxHeight: '75%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: '#FFFFFF',
    })
    expect(screen.getByTestId('order-map-sheet-scroll').props.contentContainerStyle).toEqual({
      paddingBottom: 48,
    })
    expect(screen.getByTestId('map-order-card-169340')).toBeTruthy()

    fireEvent.press(screen.getByTestId('order-map-sheet-handle'))
    expect(mockShowOrdersMap).toHaveBeenCalledWith(-1)
  })

  it('блокирует закрытие и показывает спинер во время действия', async () => {
    mockLogic.isBusy = true
    await renderSheet()

    expect(screen.getByTestId('order-map-sheet-spinner')).toBeTruthy()
    fireEvent.press(screen.getByTestId('order-map-sheet-handle'))
    expect(mockShowOrdersMap).not.toHaveBeenCalled()
  })

  it('окрашивает всю шторку для удалённого заказа', async () => {
    mockLogic.showOrders = [{ id: 169340, is_delete: 1 }]
    await renderSheet()

    expect(screen.getByTestId('order-map-sheet')).toHaveStyle({
      backgroundColor: '#D95030',
    })
  })

  it('не рендерится в закрытом состоянии', async () => {
    mockLogic.isOpenOrderMap = false
    await renderSheet()

    expect(screen.queryByTestId('order-map-sheet')).toBeNull()
  })
})
