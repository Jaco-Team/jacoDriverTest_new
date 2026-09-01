import React from 'react'
import { render, screen } from '@testing-library/react-native'

import {
  getFeedbackStatusColors,
  StatusBadge,
} from '@/features/feedback/ui/StatusBadge'

describe('стили статусов обратной связи', () => {
  it.each([
    ['Новое', '#42AAFF', '#FFFFFF', 'new'],
    ['В работе', '#FFECCF', '#253343', 'progress'],
    ['Отклонено', '#ECEFF3', '#253343', 'rejected'],
    ['Решено', '#DFF6DF', '#1F6B2A', 'resolved'],
  ] as const)('%s использует точные цвета сайта', async (status, background, text, variant) => {
    expect(getFeedbackStatusColors(status)).toEqual({ background, text })

    await render(<StatusBadge globalFontSize={14} status={status} />)

    expect(screen.getByTestId(`feedback-status-badge-${variant}`)).toHaveStyle({
      height: 30,
      backgroundColor: background,
      borderRadius: 999,
    })
    expect(screen.getByText(status)).toHaveStyle({ color: text })
  })

  it('в деталях использует высоту 32 как на сайте', async () => {
    await render(<StatusBadge globalFontSize={14} size="details" status="Решено" />)

    expect(screen.getByTestId('feedback-status-badge-resolved')).toHaveStyle({ height: 32 })
  })
})
