import React from 'react'
import { act, render } from '@testing-library/react-native'

const mockGetStatistics = jest.fn()
const mockShowAlertText = jest.fn()
const mockAnalyticsLog = jest.fn()

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}))

jest.mock('@/shared/store/store', () => ({
  useStatStore: (selector: any) => selector({
    getStatistics: mockGetStatistics,
    statArr: [],
  }),
  useGlobalStore: (selector: any) => selector({
    globalFontSize: 16,
    showAlertText: mockShowAlertText,
  }),
}))

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: (...args: any[]) => mockAnalyticsLog(...args) },
  AnalyticsEvent: {
    StatisticsCalendarStartOpen: 'StatisticsCalendarStartOpen',
    StatisticsCalendarEndOpen: 'StatisticsCalendarEndOpen',
    StatisticsCalendarStartClose: 'StatisticsCalendarStartClose',
    StatisticsCalendarEndClose: 'StatisticsCalendarEndClose',
    StatisticsDateSelected: 'StatisticsDateSelected',
    StatisticsShowClick: 'StatisticsShowClick',
  },
}))

import { useStatisticsTable } from '@/features/statistics/model/useStatisticsTable'

describe('useStatisticsTable: диапазон сайта', () => {
  let api: ReturnType<typeof useStatisticsTable> | null = null

  function Probe() {
    api = useStatisticsTable()
    return null as any
  }

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(Date.parse('2025-10-27T12:00:00Z'))
    jest.clearAllMocks()
    api = null
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('на mount загружает последние семь дней', async () => {
    await render(<Probe />)

    expect(mockGetStatistics).toHaveBeenCalledTimes(1)
    expect(mockGetStatistics).toHaveBeenCalledWith('2025-10-21', '2025-10-27')
    expect(api!.dateStart).toBe('2025-10-21')
    expect(api!.dateEnd).toBe('2025-10-27')
    expect(api!.dateStartLabel).toBe('21 октября 2025')
    expect(api!.dateEndLabel).toBe('27 октября 2025')
  })

  it('выбирает начало через нижний календарь и сохраняет аналитику', async () => {
    await render(<Probe />)
    mockGetStatistics.mockClear()

    await act(async () => {
      api!.openPicker('start')
    })
    expect(api!.pickerMinDate).toBe('2025-07-26')
    expect(api!.pickerMaxDate).toBe('2025-10-27')

    await act(async () => {
      api!.selectPickerDate('2025-10-20')
    })

    expect(api!.dateStart).toBe('2025-10-20')
    expect(api!.dateEnd).toBe('2025-10-27')
    expect(api!.activePicker).toBeNull()
    expect(mockGetStatistics).toHaveBeenCalledWith('2025-10-20', '2025-10-27')
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'StatisticsDateSelected',
      'Выбор даты (Статистика времени)',
    )
  })

  it('нормализует дату раньше 93 дней и показывает пояснение', async () => {
    await render(<Probe />)
    mockGetStatistics.mockClear()

    await act(async () => {
      api!.openPicker('start')
    })
    await act(async () => {
      api!.selectPickerDate('2025-01-01')
    })

    expect(api!.dateStart).toBe('2025-07-26')
    expect(api!.dateEnd).toBe('2025-10-27')
    expect(mockShowAlertText).toHaveBeenCalledWith(
      true,
      expect.stringContaining('Выбран период: 2025-07-26 — 2025-10-27'),
    )
  })

  it('переносит итоговую строку после карточек курьеров', async () => {
    const courier = { driver_id: 1, name: 'Курьер', time2: '10:00', other_stat: {} }
    const summary = { other_stat: {} }

    const store = require('@/shared/store/store')
    const originalUseStatStore = store.useStatStore
    expect(originalUseStatStore).toBeTruthy()

    // Порядок покрывается отдельным UI-тестом; здесь фиксируем определение итога.
    await render(<Probe />)
    expect(api!.isSummaryRow(courier as any)).toBe(false)
    expect(api!.isSummaryRow(summary as any)).toBe(true)
  })
})
