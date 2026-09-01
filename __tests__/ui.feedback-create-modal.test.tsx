import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

const mockSetIsNeedNotification = jest.fn()
const mockHandleSubmit = jest.fn()
const mockClose = jest.fn()

let mockIsNeedNotification = false

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react')
  const { TextInput } = require('react-native')
  return { BottomSheetTextInput: (props: any) => React.createElement(TextInput, props) }
})

jest.mock('react-native-image-viewing', () => () => null)

jest.mock('@/features/feedback/ui/FeedbackSheet', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    FeedbackSheet: ({ children, isOpen, testID }: any) =>
      isOpen ? React.createElement(View, { testID }, children) : null,
  }
})

jest.mock('@/features/feedback/model/useCreateFeedbackModal', () => ({
  useCreateFeedbackModal: () => ({
    isCreateModalOpen: true,
    closeCreateModal: mockClose,
    globalFontSize: 16,
    title: '',
    setTitle: jest.fn(),
    description: '',
    setDescription: jest.fn(),
    type: 'предложение',
    setType: jest.fn(),
    isNeedNotification: mockIsNeedNotification,
    setIsNeedNotification: mockSetIsNeedNotification,
    isSaving: false,
    handleSubmit: mockHandleSubmit,
    feedbackTypes: ['предложение', 'ошибка', 'улучшение', 'другое'],
    images: [],
    showImagePickerOptions: jest.fn(),
    removeImage: jest.fn(),
  }),
}))

import CreateFeedbackModal from '@/features/feedback/ui/CreateFeedbackModal'

describe('модалка создания обратной связи', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsNeedNotification = false
  })

  it('показывает структуру сайта и переключает уведомление boolean-значением', async () => {
    await render(<CreateFeedbackModal />)

    expect(screen.getByText('Новое предложение')).toBeTruthy()
    expect(screen.getByText('Тип')).toBeTruthy()
    expect(screen.getByText('Изображение (опционально)')).toBeTruthy()

    const checkbox = screen.getByTestId('feedback-notification-checkbox')
    expect(checkbox).toHaveProp('accessibilityState', {
      checked: false,
      disabled: false,
    })

    fireEvent.press(checkbox)
    expect(mockSetIsNeedNotification).toHaveBeenCalledWith(true)
  })

  it('отправляет форму отдельной основной кнопкой', async () => {
    await render(<CreateFeedbackModal />)

    fireEvent.press(screen.getByTestId('feedback-submit-button'))
    expect(mockHandleSubmit).toHaveBeenCalledTimes(1)
  })
})
