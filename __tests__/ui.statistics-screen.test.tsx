import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const mockOpenPicker = jest.fn()
const mockGetStat = jest.fn()

jest.mock('@/features/statistics/model/useStatisticsTable', () => ({
  useStatisticsTable: () => ({
    activePicker: null,
    closePicker: jest.fn(),
    dateEndLabel: '30 августа 2026',
    dateStartLabel: '24 августа 2026',
    displayRows: [
      {
        driver_id: 1,
        name: 'Иван Иванов',
        time2: '00:31:20',
        other_stat: {
          all_count: 10,
          norm: 8,
          norm_percent: 80,
          fake: 2,
          fake_percent: 20,
          time_dist_true: 7,
          time_dist_true_percent: 70,
          true_dist: 9,
          true_dist_percent: 90,
          time_dist_false: 1,
          time_dist_false_percent: 10,
        },
      },
      { other_stat: { all_count: 10 }, time2: '00:31:20' },
    ],
    getStat: mockGetStat,
    globalFontSize: 16,
    isSummaryRow: (row: any) => !row.driver_id && !row.name,
    openPicker: mockOpenPicker,
    pickerMaxDate: '2026-08-30',
    pickerMinDate: '2026-05-29',
    pickerTitle: '',
    pickerValue: '2026-08-30',
    selectPickerDate: jest.fn(),
  }),
}))

jest.mock('@/features/salary/ui/PriceDatePickerSheet', () => ({
  PriceDatePickerSheet: () => null,
}))

import { StatisticsTableScreen } from '@/features/statistics/ui/StatisticsTableScreen'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

describe('страница статистики времени', () => {
  beforeEach(() => jest.clearAllMocks())

  it('показывает диапазон, курьера и итог отдельными карточками сайта', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <StatisticsTableScreen />
      </SafeAreaProvider>,
    )

    expect(screen.getByTestId('statistics-screen')).toHaveStyle({
      flex: 1,
      backgroundColor: '#F4F7FA',
    })
    expect(screen.getByText('Статистика времени')).toBeTruthy()
    expect(screen.getByText('24 августа 2026')).toBeTruthy()
    expect(screen.getByText('30 августа 2026')).toBeTruthy()
    expect(screen.getByText('Показать статистику')).toBeTruthy()
    expect(screen.getByText('Иван Иванов')).toBeTruthy()
    expect(screen.getByText('Итого')).toBeTruthy()
    expect(screen.getAllByText('Среднее время (в радиусе)')).toHaveLength(2)
    expect(screen.getByText('8 (80%)')).toBeTruthy()
    expect(screen.queryByText('Курьер')).toBeNull()
  })

  it('сохраняет обработчики выбора диапазона и загрузки', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <StatisticsTableScreen />
      </SafeAreaProvider>,
    )

    await fireEvent.press(screen.getByTestId('statistics-start-date'))
    await fireEvent.press(screen.getByTestId('statistics-end-date'))
    await fireEvent.press(screen.getByTestId('statistics-submit'))

    expect(mockOpenPicker).toHaveBeenNthCalledWith(1, 'start')
    expect(mockOpenPicker).toHaveBeenNthCalledWith(2, 'end')
    expect(mockGetStat).toHaveBeenCalledTimes(1)
  })
})
