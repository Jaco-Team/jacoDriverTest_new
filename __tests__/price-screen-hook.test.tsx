import React from 'react'
import { act, render, waitFor } from '@testing-library/react-native'

const mockGetStatBetween = jest.fn()
const mockAnalyticsLog = jest.fn()

let mockStatState: any
let mockGlobalState: any

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}))

jest.mock('@/shared/store/store', () => ({
  useStatStore: (selector: any) => selector(mockStatState),
  useGlobalStore: (selector: any) => selector(mockGlobalState),
}))

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: (...args: any[]) => mockAnalyticsLog(...args) },
  AnalyticsEvent: {
    PriceStartCalendarOpen: 'PriceStartCalendarOpen',
    PriceStartCalendarClose: 'PriceStartCalendarClose',
    PriceEndCalendarOpen: 'PriceEndCalendarOpen',
    PriceEndCalendarClose: 'PriceEndCalendarClose',
  },
}))

import { usePriceScreen } from '@/features/salary/model/usePriceScreen'

describe('usePriceScreen', () => {
  let api: ReturnType<typeof usePriceScreen> | null = null

  function Probe() {
    api = usePriceScreen()
    return null as any
  }

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(Date.parse('2026-08-30T12:00:00Z'))
    jest.clearAllMocks()
    api = null
    mockGlobalState = { globalFontSize: 16 }
    mockStatState = {
      FormatPrice: (value: number) => new Intl.NumberFormat('ru-RU').format(value),
      getStatBetween: mockGetStatBetween,
      give_history: [{ give: 500, time: '12:15' }],
      statPrice: {
        sum_cash: 1500,
        sum_bank: 900,
        my_price: 700,
        sdacha: 800,
        my_cash: 300,
        count_cash: 2,
        count_bank: 1,
        count: 3,
        full_give: 500,
      },
    }
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('загружает текущий день и формирует строки по данным legacy store', async () => {
    await render(<Probe />)

    expect(mockGetStatBetween).toHaveBeenCalledWith('2026-08-30', '2026-08-30')
    expect(api!.showDateStart).toBe('30 августа 2026')
    expect(api!.showDateEnd).toBe('30 августа 2026')
    expect(api!.totalPriceLabel).toBe('700 ₽')
    expect(api!.summaryRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Сумма налички', value: '1 500 ₽' }),
        expect.objectContaining({ label: 'Заработал', value: '700 ₽', emphasize: true }),
      ]),
    )
    expect(api!.settlementRows).toEqual([
      { label: '12:15', value: '500 ₽' },
      { label: 'Всего сдал', value: '500 ₽', emphasize: true },
      { label: 'Осталось сдать', value: '300 ₽', emphasize: true, hideDivider: true },
    ])
  })

  it('ограничивает календари диапазоном сайта и обновляет выбранные даты', async () => {
    await render(<Probe />)
    mockGetStatBetween.mockClear()

    await act(async () => {
      api!.openStartPicker()
    })

    expect(api!.activePicker).toBe('start')
    expect(api!.pickerMinDate).toBe('2026-05-29')
    expect(api!.pickerMaxDate).toBe('2026-08-30')

    await act(async () => {
      api!.selectPickerDate('2026-08-20')
    })

    await waitFor(() => {
      expect(api!.dateStart).toBe('2026-08-20')
      expect(mockGetStatBetween).toHaveBeenCalledWith('2026-08-20', '2026-08-30')
    })
    expect(api!.activePicker).toBeNull()

    await act(async () => {
      api!.openEndPicker()
    })

    expect(api!.pickerMinDate).toBe('2026-08-20')
    expect(api!.pickerMaxDate).toBe('2026-08-30')
  })

  it('сохраняет аналитику открытия и закрытия календаря', async () => {
    await render(<Probe />)

    await act(async () => {
      api!.openStartPicker()
    })
    await act(async () => {
      api!.closePicker()
    })

    expect(mockAnalyticsLog).toHaveBeenNthCalledWith(
      1,
      'PriceStartCalendarOpen',
      'Открытие календаря (Расчет): Дата от',
    )
    expect(mockAnalyticsLog).toHaveBeenNthCalledWith(
      2,
      'PriceStartCalendarClose',
      'Закрытие календаря (Расчет): Дата от',
    )
  })
})
