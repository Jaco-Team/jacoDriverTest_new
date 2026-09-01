import React from 'react'
import { Keyboard } from 'react-native'
import { act, render, screen } from '@testing-library/react-native'

const mockFeedbackState = {
  feedbacks: [],
  modal: {
    isCreateModalOpen: false,
    isViewModalOpen: false,
    selectedFeedback: null,
  },
  openCreateModal: jest.fn(),
  chooseStatus: '',
  setStatus: jest.fn(),
  searchQuery: '',
  setSearchQuery: jest.fn(),
}

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}))

jest.mock('@/shared/store/store', () => ({
  useGlobalStore: (selector: any) => selector({ globalFontSize: 16 }),
  useFeedbackStore: (selector: any) => selector(mockFeedbackState),
}))

jest.mock('@/shared/ui/ScreenLayout', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { ScreenLayout: ({ children }: any) => React.createElement(View, null, children) }
})

jest.mock('@/features/feedback/ui/FeedbackList', () => () => null)
jest.mock('@/features/feedback/ui/CreateFeedbackModal', () => () => null)
jest.mock('@/features/feedback/ui/ViewFeedbackModal', () => () => null)

import { FeedbackScreen } from '@/features/feedback/ui/FeedbackScreen'

describe('focus-стиль поиска обратной связи', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('добавляет бордер и внешнее кольцо сайта только в фокусе', async () => {
    await render(<FeedbackScreen />)

    const field = screen.getByTestId('feedback-search-input')
    const box = screen.getByTestId('feedback-search-box')

    expect(box).toHaveStyle({ borderColor: 'rgba(66, 98, 125, 0.16)' })

    await act(async () => field.props.onFocus())
    expect(screen.getByTestId('feedback-search-box')).toHaveStyle({
      borderColor: '#3F5F7B',
      boxShadow: '0 0 0 3px rgba(66, 98, 125, 0.12)',
    })

    await act(async () => field.props.onBlur())
    expect(screen.getByTestId('feedback-search-box')).toHaveStyle({
      borderColor: 'rgba(66, 98, 125, 0.16)',
    })
  })

  it('снимает фокус при касании фона страницы', async () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss')
    await render(<FeedbackScreen />)

    const field = screen.getByTestId('feedback-search-input')
    await act(async () => field.props.onFocus())

    await act(async () => screen.getByTestId('feedback-screen').props.onPress())

    expect(dismissSpy).toHaveBeenCalled()
    expect(screen.getByTestId('feedback-search-box')).toHaveStyle({
      borderColor: 'rgba(66, 98, 125, 0.16)',
    })
  })

  it('снимает фокус при выборе статуса и открытии формы', async () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss')
    await render(<FeedbackScreen />)

    const field = screen.getByTestId('feedback-search-input')
    await act(async () => field.props.onFocus())
    await act(async () => screen.getByTestId('feedback-status-Новое').props.onPress())

    expect(mockFeedbackState.setStatus).toHaveBeenCalledWith('Новое')
    expect(dismissSpy).toHaveBeenCalled()
    expect(screen.getByTestId('feedback-search-box')).toHaveStyle({
      borderColor: 'rgba(66, 98, 125, 0.16)',
    })

    await act(async () => field.props.onFocus())
    await act(async () => screen.getByTestId('feedback-create-button').props.onPress())

    expect(mockFeedbackState.openCreateModal).toHaveBeenCalled()
    expect(dismissSpy).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('feedback-search-box')).toHaveStyle({
      borderColor: 'rgba(66, 98, 125, 0.16)',
    })
  })
})
