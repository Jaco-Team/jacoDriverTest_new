import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'

const mockFetchFeedbacks = jest.fn()
const mockFetchFeedbackById = jest.fn()

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}))

jest.mock('@/shared/store/store', () => ({
  useFeedbackStore: (selector: any) => selector({
    fetchFeedbacks: mockFetchFeedbacks,
    fetchFeedbackById: mockFetchFeedbackById,
  }),
}))

jest.mock('@/features/feedback/ui/FeedbackItem', () => ({
  __esModule: true,
  default: ({ onPress }: { onPress: () => void }) => {
    const React = require('react')
    const { Pressable, Text } = require('react-native')
    return React.createElement(
      Pressable,
      { onPress, testID: 'mock-feedback-item' },
      React.createElement(Text, null, 'Карточка'),
    )
  },
}))

import FeedbackList from '@/features/feedback/ui/FeedbackList'

const feedback = {
  id: 7,
  title: 'Идея',
  description: 'Описание',
  user: 'Driver',
  date_time_create: new Date('2026-08-31T10:00:00Z'),
  status: 'Новое' as const,
  answer: '',
  type: 'предложение' as const,
  images: [],
}

describe('закрытие клавиатуры из ленты обратной связи', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('закрывает клавиатуру при прокрутке и перед открытием карточки', async () => {
    const onDismissKeyboard = jest.fn()
    await render(
      <FeedbackList
        feedbacks={[feedback]}
        globalFontSize={16}
        onDismissKeyboard={onDismissKeyboard}
      />,
    )

    const list = screen.getByTestId('feedback-list')
    expect(list).toHaveProp('keyboardDismissMode', 'on-drag')
    expect(list).toHaveProp('keyboardShouldPersistTaps', 'never')

    await act(async () => list.props.onScrollBeginDrag())
    expect(onDismissKeyboard).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByTestId('mock-feedback-item'))
    expect(onDismissKeyboard).toHaveBeenCalledTimes(2)
    expect(mockFetchFeedbackById).toHaveBeenCalledWith(7)
  })
})
