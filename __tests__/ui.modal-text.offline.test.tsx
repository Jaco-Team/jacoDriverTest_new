import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

let mockScheme: 'light' | 'dark' = 'light'
const mockShowModalText = jest.fn()

jest.unmock('@/shared/ui/ModalText')

jest.mock('@/components/ui/actionsheet', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    Actionsheet: ({ children }: any) => React.createElement(View, null, children),
    ActionsheetBackdrop: View,
    ActionsheetContent: View,
    ActionsheetDragIndicator: View,
    ActionsheetDragIndicatorWrapper: View,
  }
})

jest.mock('@/shared/theme/AppThemeProvider', () => ({
  useAppTheme: () => ({ colors: require('@/shared/styles/appPalette').appPalettes[mockScheme] }),
}))

jest.mock('@/shared/store/store', () => ({
  useGlobalStore: (selector: (state: unknown) => unknown) => selector({
    is_show_modal_text: true,
    modal_text: 'Нет интернета. Действие будет доступно после восстановления связи.',
    showModalText: mockShowModalText,
    globalFontSize: 16,
  }),
}))

import { ModalText } from '@/shared/ui/ModalText'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

describe('сообщение об офлайн-действии', () => {
  beforeEach(() => mockShowModalText.mockClear())

  it.each([
    ['light', '#FFFFFF', '#1F2D38', '#CC0033'],
    ['dark', '#161F28', '#F2F5F7', '#B52A48'],
  ] as const)('использует тему %s и закрывается без действия над заказом', async (scheme, surface, text, brand) => {
    mockScheme = scheme
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ModalText />
      </SafeAreaProvider>,
    )

    expect(screen.getByTestId('message-modal-sheet')).toHaveStyle({ backgroundColor: surface })
    expect(screen.getByText('Нет интернета')).toHaveStyle({ color: text })
    expect(screen.getByText('Действие будет доступно после восстановления связи.')).toBeTruthy()
    expect(screen.getByTestId('message-modal-close')).toHaveStyle({ backgroundColor: brand })

    await fireEvent.press(screen.getByTestId('message-modal-close'))
    expect(mockShowModalText).toHaveBeenCalledWith(false)
  })
})
