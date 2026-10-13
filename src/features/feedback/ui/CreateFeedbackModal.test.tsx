import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import CreateFeedbackModal from './CreateFeedbackModal'

const mockHandleClose = jest.fn()

jest.mock('../model/useCreateFeedbackModal', () => ({
  useCreateFeedbackModal: () => ({
    isCreateModalOpen: true,
    handleClose: mockHandleClose,
    globalFontSize: 16,
    title: '',
    setTitle: jest.fn(),
    description: '',
    setDescription: jest.fn(),
    type: 'предложение',
    setType: jest.fn(),
    isNeedNotification: false,
    setIsNeedNotification: jest.fn(),
    isSaving: false,
    handleSubmit: jest.fn(),
    feedbackTypes: [],
    images: [],
    showImagePickerOptions: jest.fn(),
    removeImage: jest.fn(),
  }),
}))

jest.mock('./FeedbackSheet', () => {
  const ReactModule = jest.requireActual('react')
  const { Pressable, View } = jest.requireActual('react-native')

  return {
    FeedbackSheet: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) =>
      ReactModule.createElement(
        View,
        null,
        ReactModule.createElement(Pressable, { testID: 'feedback-sheet-close', onPress: onClose }),
        children,
      ),
  }
})

jest.mock('react-native-image-viewing', () => () => null)

jest.mock('@/shared/theme/AppThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      border: '#cccccc',
      brand: '#920024',
      brandDeep: '#600018',
      surface: '#ffffff',
      surfaceRaised: '#ffffff',
      text: '#111111',
      textMuted: '#666666',
    },
  }),
}))

describe('CreateFeedbackModal', () => {
  beforeEach(() => {
    mockHandleClose.mockClear()
  })

  it('uses the draft-resetting close handler', async () => {
    await render(<CreateFeedbackModal />)

    fireEvent.press(screen.getByTestId('feedback-sheet-close'))

    expect(mockHandleClose).toHaveBeenCalledTimes(1)
  })
})
