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

jest.mock('lucide-react-native', () => {
  const React = require('react')
  const { View } = require('react-native')
  const Phone = (props: any) =>
    React.createElement(View, { ...props, testID: 'Phone' })

  return { Phone }
})

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: jest.fn() },
  AnalyticsEvent: {
    OrderCallClient: 'OrderCallClient',
    OrderCommentPhonesOpen: 'OrderCommentPhonesOpen',
  },
}))

import { CommentText } from '@/entities/CardOrder/ui/CommentText'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

async function renderComment(comment: string, dialCall = jest.fn()) {
  const result = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CommentText
        comment={comment}
        dialCall={dialCall}
        globalFontSize={16}
        showAlertText={jest.fn()}
      />
    </SafeAreaProvider>,
  )

  return {
    dialCall,
    ...result,
  }
}

describe('телефоны в комментарии заказа', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('звонит по единственному номеру через телефонную кнопку', async () => {
    const { Analytics } = require('@/analytics/AppMetricaService')
    const { dialCall } = await renderComment(
      'Позвонить +7 (999) 111-22-33 перед доставкой',
    )

    expect(screen.getByTestId('Phone')).toBeTruthy()
    expect(screen.queryByTestId('order-card-comment-phones-drawer')).toBeNull()

    await fireEvent.press(screen.getByTestId('order-card-comment-call'))

    expect(dialCall).toHaveBeenCalledWith('+79991112233')
    expect(Analytics.log).toHaveBeenCalledWith(
      'OrderCallClient',
      'Звонок клиенту из комментария',
    )
  })

  it('не показывает действие, если в комментарии нет номера', async () => {
    await renderComment('Домофон не работает')

    expect(screen.getByTestId('comment-row')).toHaveTextContent(
      'Комментарий: Домофон не работает',
    )
    expect(screen.queryByTestId('order-card-comment-call')).toBeNull()
  })

  it('открывает выбор нескольких номеров и звонит по выбранному', async () => {
    const { Analytics } = require('@/analytics/AppMetricaService')
    const { dialCall } = await renderComment(
      'Клиент +7 999 111-22-33, получатель 8 (999) 444-55-66',
    )

    expect(screen.getByTestId('order-card-comment-call')).toHaveTextContent('2')
    expect(screen.queryByTestId('order-card-comment-phones-drawer')).toBeNull()

    await fireEvent.press(screen.getByTestId('order-card-comment-call'))

    expect(screen.getByTestId('order-card-comment-phones-drawer')).toBeTruthy()
    expect(screen.getByText('8 (999) 111-22-33')).toBeTruthy()
    expect(screen.getByText('8 (999) 444-55-66')).toBeTruthy()
    expect(Analytics.log).toHaveBeenCalledWith(
      'OrderCommentPhonesOpen',
      'Открытие номеров из комментария',
    )

    await fireEvent.press(
      screen.getByTestId('order-card-comment-phone-79994445566'),
    )

    expect(dialCall).toHaveBeenCalledWith('+79994445566')
    expect(screen.queryByTestId('order-card-comment-phones-drawer')).toBeNull()
  })
})
