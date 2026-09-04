import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

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

import {
  OrderConfirmModal,
  type OrderConfirmType,
} from '@/entities/CardOrder/ui/ModalConfirm'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

interface RenderConfirmOptions {
  typeConfirm: OrderConfirmType
  orderId?: number
  busy?: boolean
  onClose?: jest.Mock
  onConfirm?: jest.Mock
}

async function renderConfirm({
  typeConfirm,
  orderId = 910002,
  busy = false,
  onClose = jest.fn(),
  onConfirm = jest.fn(),
}: RenderConfirmOptions) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <OrderConfirmModal
        busy={busy}
        globalFontSize={16}
        isOpen
        orderId={orderId}
        typeConfirm={typeConfirm}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </SafeAreaProvider>,
  )
}

describe('подтверждение действия заказа', () => {
  it('показывает нижнюю шторку завершения и вызывает действия', async () => {
    const onClose = jest.fn()
    const onConfirm = jest.fn()

    await renderConfirm({ typeConfirm: 'finish', onClose, onConfirm })

    expect(screen.getByTestId('order-confirm-sheet')).toHaveStyle({
      maxHeight: '75%',
      paddingHorizontal: 20,
      paddingBottom: 62,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: '#FFFFFF',
    })
    expect(screen.getByTestId('order-confirm-title')).toHaveTextContent(
      'Завершить заказ',
    )
    expect(screen.getByTestId('order-confirm-message')).toHaveTextContent(
      'Заказ #910002 будет отмечен как доставленный.',
    )
    expect(screen.getByTestId('order-confirm-message')).toHaveStyle({
      width: '100%',
      alignSelf: 'stretch',
      textAlign: 'left',
    })
    expect(screen.getByTestId('order-confirm-modal')).toHaveStyle({
      width: '100%',
      alignSelf: 'stretch',
    })
    expect(
      screen.getByTestId('order-confirm-icon-check-circle'),
    ).toBeTruthy()
    expect(screen.getByText('Нет')).toBeTruthy()
    expect(screen.getByText('Завершить')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('order-confirm-no'))
    expect(onClose).toHaveBeenCalledTimes(1)

    await fireEvent.press(screen.getByTestId('order-confirm-submit'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      'cancel',
      'Отменить заказ',
      'Заказ #910002 вернётся в общую очередь.',
      'Отменить',
      '#CC0033',
    ],
    [
      'fake',
      'Клиент не вышел на связь',
      'Подтвердите по заказу #910002.',
      'Подтвердить',
      '#FF9800',
    ],
  ] as const)(
    'показывает вариант %s',
    async (typeConfirm, title, message, confirmText, confirmColor) => {
      await renderConfirm({ typeConfirm })

      expect(screen.getByTestId('order-confirm-title')).toHaveTextContent(title)
      expect(screen.getByTestId('order-confirm-message')).toHaveTextContent(
        message,
      )
      expect(screen.getByText(confirmText)).toBeTruthy()
      expect(screen.getByTestId('order-confirm-submit')).toHaveStyle({
        height: 44,
        minHeight: 44,
        borderRadius: 12,
        backgroundColor: confirmColor,
      })
      expect(
        screen.getByTestId(
          `order-confirm-icon-${
            typeConfirm === 'cancel' ? 'cancel' : 'person-off'
          }`,
        ),
      ).toBeTruthy()
    },
  )
})
