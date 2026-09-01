import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'

jest.mock('@/shared/store/store', () => ({
  useGlobalStore: (selector: any) => selector({ globalFontSize: 16 }),
}))

jest.mock('@/entities/CardOrder/ui/ModalConfirm', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')

  return {
    OrderConfirmModal: ({ isOpen, onConfirm }: any) =>
      isOpen
        ? React.createElement(
            Pressable,
            { testID: 'preview-confirm', onPress: onConfirm },
            React.createElement(Text, null, 'Подтвердить'),
          )
        : null,
  }
})

jest.mock('@/features/schedule/ui/ModalErrOrder', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')

  return {
    ModalErrOrder: ({ preview }: any) =>
      preview.isOpen
        ? React.createElement(
          Pressable,
          {
            testID: 'preview-order-error-sheet',
            onPress: () => preview.onSubmit('Проверка'),
          },
          React.createElement(Text, null, 'Ошибка по заказу'),
        )
        : null,
  }
})

jest.mock('@/features/schedule/ui/ModalErrCam', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')

  return {
    ModalErrCam: ({ preview }: any) =>
      preview.isOpen
        ? React.createElement(
          Pressable,
          {
            testID: 'preview-camera-error-sheet',
            onPress: () => preview.onSubmit('Проверка'),
          },
          React.createElement(Text, null, 'Ошибка по камере'),
        )
        : null,
  }
})

import { OrdersUiPreviewScreen } from '@/app/screens/OrdersUiPreviewScreen'

describe('временный DEV-предпросмотр заказов', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn())
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('показывает все состояния карточки на локальных данных', async () => {
    await render(<OrdersUiPreviewScreen />)

    expect(screen.getAllByTestId(/^preview-order-/)).toHaveLength(6)
    expect(screen.getByText('Свободный предзаказ')).toBeTruthy()
    expect(screen.getByTestId('order-time-start')).toHaveTextContent(
      'Начнут готовить: 16:05',
    )
    expect(screen.getByText('Мой заказ — наличные')).toBeTruthy()
    expect(screen.getByText('Мой заказ — оплачен')).toBeTruthy()
    expect(screen.getByText('Завершённый заказ')).toBeTruthy()
    expect(screen.getByText('Отменённый заказ')).toBeTruthy()
    expect(screen.getByText('У другого курьера')).toBeTruthy()
  })

  it('перехватывает действия без API и GPS', async () => {
    await render(<OrdersUiPreviewScreen />)

    await fireEvent.press(screen.getByTestId('order-910001-take'))
    expect(Alert.alert).toHaveBeenCalledWith(
      'UI-предпросмотр',
      expect.stringContaining('Запрос не отправлен.'),
    )

    await fireEvent.press(screen.getByTestId('order-910002-cancel'))
    const safeConfirm = screen.getByTestId('preview-confirm')
    expect(safeConfirm).toBeTruthy()

    await fireEvent.press(safeConfirm)
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'UI-предпросмотр',
      expect.stringContaining('Подтверждение для заказа 910002'),
    )
  })

  it('открывает обе рабочие модалки графика без вызова API', async () => {
    await render(<OrdersUiPreviewScreen />)

    await fireEvent.press(screen.getByTestId('preview-graph-order-error'))
    const orderSheet = screen.getByTestId('preview-order-error-sheet')
    expect(orderSheet).toBeTruthy()
    await fireEvent.press(orderSheet)
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'UI-предпросмотр',
      expect.stringContaining('Обжалование ошибки по заказу'),
    )

    await fireEvent.press(screen.getByTestId('preview-graph-camera-error'))
    const cameraSheet = screen.getByTestId('preview-camera-error-sheet')
    expect(cameraSheet).toBeTruthy()
    await fireEvent.press(cameraSheet)
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'UI-предпросмотр',
      expect.stringContaining('Обжалование ошибки по камере'),
    )
  })
})
