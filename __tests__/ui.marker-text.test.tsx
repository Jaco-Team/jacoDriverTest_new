import React from 'react'
import { render, screen } from '@testing-library/react-native'

let mockIsDark = false

jest.mock('@/shared/theme/AppThemeProvider', () => ({
  useAppTheme: () => ({ isDark: mockIsDark }),
}))

import { MarkerText } from '@/shared/ui/MarkerText'

describe('подпись заказа на карте', () => {
  beforeEach(() => {
    mockIsDark = false
  })

  it.each([
    ['transparent_white', false, '#000000'],
    ['transparent', true, '#FFFFFF'],
  ] as const)(
    'делает прозрачный вариант %s контрастным для темы isDark=%s',
    async (theme, isDark, expectedColor) => {
      mockIsDark = isDark

      await render(
        <MarkerText
          globalFontSize={16}
          theme={theme}
          text="16:15 - 16:45"
        />,
      )

      expect(screen.getByText('16:15 - 16:45')).toHaveStyle({
        color: expectedColor,
      })
    },
  )

  it.each([
    ['white_border', true, '#000000'],
    ['black', false, '#FFFFFF'],
  ] as const)(
    'сохраняет контраст текста варианта %s независимо от темы',
    async (theme, isDark, expectedColor) => {
      mockIsDark = isDark

      await render(
        <MarkerText
          globalFontSize={16}
          theme={theme}
          text="16:15 - 16:45"
        />,
      )

      expect(screen.getByText('16:15 - 16:45')).toHaveStyle({
        color: expectedColor,
      })
    },
  )
})
