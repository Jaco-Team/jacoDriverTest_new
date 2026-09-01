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
    statArr: [{ driver_id: 1, name: 'Курьер', time2: '', other_stat: {} }],
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

describe('useStatisticsTable: ручное обновление с кнопки сайта', () => {
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

  it('повторно запрашивает текущий диапазон по кнопке «Показать статистику»', async () => {
    await render(<Probe />)
    mockGetStatistics.mockClear()

    await act(async () => {
      api!.getStat()
    })

    expect(mockGetStatistics).toHaveBeenCalledWith('2025-10-21', '2025-10-27')
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'StatisticsShowClick',
      'Показать статистику времени',
    )
  })
})
