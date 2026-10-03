import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

const mockShowAlertText = jest.fn()

jest.unmock('@/shared/ui/CustomAlert')

jest.mock('@/shared/store/store', () => ({
  useGlobalStore: (selector: (state: unknown) => unknown) => selector({
    is_show_alert_text: true,
    modal_text: 'Настройки сохранены',
    showAlertText: mockShowAlertText,
    globalFontSize: 16,
  }),
}))

import { CustomAlert } from '@/shared/ui/CustomAlert'

describe('CustomAlert', () => {
  beforeEach(() => mockShowAlertText.mockClear())

  it('closes when the close button is pressed', async () => {
    const screen = await render(<CustomAlert />)

    expect(screen.getByTestId('custom-alert-container').props.onStartShouldSetResponder()).toBe(false)
    await fireEvent.press(screen.getByTestId('custom-alert-close'))

    expect(mockShowAlertText).toHaveBeenCalledWith(false)
    expect(screen.getByText('Настройки сохранены')).toHaveStyle({ color: '#ffffff' })
  })
})
