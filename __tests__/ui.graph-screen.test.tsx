import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const mockSetMonthOpen = jest.fn()
const mockSelectMonth = jest.fn()
const mockShowOrderError = jest.fn()
const mockShowCameraError = jest.fn()
let mockMonthOpen = false

jest.mock('@/features/schedule/model/useGraphLogic', () => ({
  useGraphLogic: jest.fn(),
}))

jest.mock('@/features/schedule/model/useChooseMonthLogic', () => ({
  useChooseMonthLogic: () => ({
    month_list: [
      { day: '2026-08', mounth: 'Август 2026', is_active: 1 },
      { day: '2026-07', mounth: 'Июль 2026', is_active: 0 },
    ],
    activeMounth: 'Август 2026',
    isOpenDateMenu: mockMonthOpen,
    setIsOpenDateMenu: mockSetMonthOpen,
    onSelectMonth: mockSelectMonth,
    globalFontSize: 16,
  }),
}))

jest.mock('@/features/schedule/model/useGraphTable', () => ({
  useGraphTable: () => ({
    dates: [
      { date: '2026-08-30', day: '30', dow: 'Вс' },
      { date: '2026-08-31', day: '31', dow: 'Пн' },
    ],
    thisDay: '2026-08-30',
    headerDay: ['30', '31'],
    headerDow: ['Вс', 'Пн'],
    users: [[
      { user_name: 'Иван' },
      { date: '2026-08-30', min: 480, hours: '8' },
      { date: '2026-08-31', min: 0, hours: '0' },
    ]],
    user_name: 'Иван',
    globalFontSize: 16,
  }),
}))

jest.mock('@/features/schedule/model/useError', () => ({
  useErrorOrders: () => ({
    globalFontSize: 16,
    err_orders: [{
      err_id: 1,
      row_id: 2,
      order_id: 10,
      date_time_order: '30.08.2026 12:00',
      pr_name: 'Опоздание',
    }],
    showModalErrOrder: mockShowOrderError,
  }),
  useErrorCamera: () => ({
    globalFontSize: 16,
    err_cam: [],
    showModalErrCam: mockShowCameraError,
  }),
}))

jest.mock('@/features/schedule/ui/ModalErrOrder', () => ({ ModalErrOrder: () => null }))
jest.mock('@/features/schedule/ui/ModalErrCam', () => ({ ModalErrCam: () => null }))

jest.mock('@/components/ui/actionsheet', () => {
  const React = require('react')
  const { Pressable, View } = require('react-native')
  return {
    Actionsheet: ({ children, isOpen }: any) =>
      isOpen ? React.createElement(View, null, children) : null,
    ActionsheetBackdrop: View,
    ActionsheetContent: View,
    ActionsheetDragIndicator: View,
    ActionsheetDragIndicatorWrapper: View,
    ActionsheetItem: Pressable,
  }
})

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: jest.fn() },
  AnalyticsEvent: {
    GraphMonthPickerOpen: 'GraphMonthPickerOpen',
    GraphMonthPickerClose: 'GraphMonthPickerClose',
    GraphMonthSelected: 'GraphMonthSelected',
  },
}))

import { GraphScreen } from '@/features/schedule/ui/GraphScreen'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

describe('страница графика работы', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMonthOpen = false
  })

  it('показывает карточки и таблицы актуального сайта без pull-to-refresh', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <GraphScreen />
      </SafeAreaProvider>,
    )

    expect(screen.getByTestId('graph-screen')).toHaveStyle({
      flex: 1,
      backgroundColor: '#F4F7FA',
    })
    expect(screen.getByTestId('graph-month-card')).toHaveStyle({ borderRadius: 24 })
    expect(screen.getByText('График работы')).toBeTruthy()
    expect(screen.getByText('Август 2026')).toBeTruthy()
    expect(screen.getByText('Таблица смен')).toBeTruthy()
    expect(screen.getByText('Дата')).toBeTruthy()
    expect(screen.getByText('Сотрудник')).toBeTruthy()
    expect(screen.getByText('Иван')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('Ошибки по заказам')).toBeTruthy()
    expect(screen.getByText('Ошибки по камерам')).toBeTruthy()
    expect(screen.getByText('Ошибок по камерам за выбранный период нет.')).toBeTruthy()
    expect(screen.queryByTestId('graph-refresh-control')).toBeNull()
    expect(screen.getByTestId('graph-header-date-0')).toHaveStyle({
      color: '#CC0033',
    })
    expect(screen.getByTestId('graph-header-dow-0')).toHaveStyle({
      color: '#CC0033',
    })
  })

  it('открывает выбор месяца и ошибку заказа существующими обработчиками', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <GraphScreen />
      </SafeAreaProvider>,
    )

    await fireEvent.press(screen.getByTestId('graph-month-trigger'))
    await fireEvent.press(screen.getByTestId('graph-order-error-0'))

    expect(mockSetMonthOpen).toHaveBeenCalledWith(true)
    expect(mockShowOrderError).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ order_id: 10 }),
    )
  })

  it('рисует выбранный месяц одной цельной поверхностью и передаёт выбор', async () => {
    mockMonthOpen = true

    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <GraphScreen />
      </SafeAreaProvider>,
    )

    const selectedOption = screen.getByTestId('graph-month-option-2026-08')
    const selectedLabel = within(selectedOption).getByText('Август 2026')

    expect(selectedOption).toHaveStyle({
      backgroundColor: '#F0F2F5',
    })
    expect(selectedLabel).toHaveStyle({ backgroundColor: '#F0F2F5' })

    await fireEvent.press(selectedOption)
    expect(mockSelectMonth).toHaveBeenCalledWith('2026-08', 'Август 2026')
  })
})
