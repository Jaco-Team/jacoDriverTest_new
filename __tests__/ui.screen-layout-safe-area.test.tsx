import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'

import { ScreenLayout } from '@/shared/ui/ScreenLayout'

describe('ScreenLayout и системные отступы', () => {
  it('не дублирует верхний inset под drawer-шапкой', async () => {
    const screen = await render(
      <ScreenLayout>
        <Text>Экран</Text>
      </ScreenLayout>,
    )

    const safeArea = screen.getByTestId('screen-layout-safe-area')

    expect(safeArea.props.edges).toEqual(['right', 'bottom', 'left'])
    expect(safeArea.props.edges).not.toContain('top')
  })

  it('сохраняет те же системные края для варианта с прокруткой', async () => {
    const screen = await render(
      <ScreenLayout withScroll>
        <Text>Экран</Text>
      </ScreenLayout>,
    )

    expect(screen.getByTestId('screen-layout-safe-area').props.edges).toEqual([
      'right',
      'bottom',
      'left',
    ])
    expect(screen.getByTestId('screen-layout-scroll')).toBeTruthy()
  })

  it('позволяет экрану без drawer явно выбрать собственные края', async () => {
    const screen = await render(
      <ScreenLayout safeAreaEdges={['top', 'bottom']}>
        <Text>Отдельный экран</Text>
      </ScreenLayout>,
    )

    expect(screen.getByTestId('screen-layout-safe-area').props.edges).toEqual([
      'top',
      'bottom',
    ])
  })
})
