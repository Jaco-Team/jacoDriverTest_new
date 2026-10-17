import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { darkAppPalette, lightAppPalette } from '@/shared/styles/appPalette'

const mockShowModalTypeDop = jest.fn()
const mockSetTypeDop = jest.fn()
let mockFilterLogic: any
let mockTheme: any

jest.mock('@/shared/theme/AppThemeProvider', () => ({
  useAppTheme: () => mockTheme,
}))

jest.mock('@/features/orders-map/model/useModalOrderLogic', () => ({
  useModalFilterOrdersLogic: () => mockFilterLogic,
}))

jest.mock('@/components/ui/actionsheet', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    Actionsheet: ({ children, isOpen }: any) =>
      isOpen ? React.createElement(View, null, children) : null,
    ActionsheetBackdrop: View,
    ActionsheetContent: View,
    ActionsheetDragIndicator: View,
    ActionsheetDragIndicatorWrapper: View,
    ActionsheetScrollView: View,
  }
})

jest.mock('lucide-react-native', () => {
  const React = require('react')
  const { View } = require('react-native')
  const Check = (props: any) =>
    React.createElement(View, { ...props, testID: 'filter-check' })

  return { Check }
})

import { ModalFilterOrders } from '@/features/orders-map/ui/ModalFilterOrders'

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

async function renderFilter(): Promise<void> {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ModalFilterOrders />
    </SafeAreaProvider>,
  )
}

describe('фильтр активных заказов', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTheme = { colors: lightAppPalette, isDark: false }
    mockFilterLogic = {
      globalFontSize: 16,
      types_dop: [
        { id: 1, text: 'В очереди' },
        { id: 2, text: 'Готовится' },
        { id: 4, text: 'На сборке' },
        { id: 3, text: 'Собран' },
      ],
      type_dop: ['1', '2'],
      is_showModalTypeDop: true,
      showModalTypeDop: mockShowModalTypeDop,
      setTypeDop: mockSetTypeDop,
      statusCounts: { '1': 2, '2': 0, '3': 4, '4': 2 },
    }
  })

  it('показывает шторку и состояния кнопок по сайту', async () => {
    await renderFilter()

    expect(screen.getByText('Активные заказы')).toBeTruthy()
    expect(screen.getByText('Какие статусы показывать')).toBeTruthy()
    expect(screen.getByText('На сборке')).toBeTruthy()
    expect(screen.getByText('Активные заказы')).toHaveStyle({
      width: '100%',
      textAlign: 'left',
    })
    expect(screen.getByText('Какие статусы показывать')).toHaveStyle({
      width: '100%',
      textAlign: 'left',
    })
    expect(screen.getByTestId('orders-filter-sheet')).toHaveStyle({
      maxHeight: '75%',
      paddingHorizontal: 20,
      paddingBottom: 62,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: '#FFFFFF',
    })
    expect(screen.getByTestId('orders-filter-option-1')).toHaveStyle({
      minHeight: 44,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: '#CC0033',
    })
    expect(screen.getByTestId('orders-filter-option-3')).toHaveStyle({
      minHeight: 44,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: '#E9EEF3',
    })
    expect(screen.getAllByTestId('filter-check')).toHaveLength(2)
  })

  it('добавляет и убирает статус через существующий setTypeDop', async () => {
    await renderFilter()

    await fireEvent.press(screen.getByTestId('orders-filter-option-1'))
    expect(mockSetTypeDop).toHaveBeenCalledWith(['2'])

    await fireEvent.press(screen.getByTestId('orders-filter-option-3'))
    expect(mockSetTypeDop).toHaveBeenCalledWith(['1', '2', '3'])

    await fireEvent.press(screen.getByTestId('orders-filter-option-4'))
    expect(mockSetTypeDop).toHaveBeenCalledWith(['1', '2', '4'])
  })

  it('показывает количество каждого статуса, включая невыбранный и пустой', async () => {
    await renderFilter()

    expect(screen.getByTestId('orders-filter-count-1').props.children).toBe(2)
    expect(screen.getByTestId('orders-filter-count-2').props.children).toBe(0)
    expect(screen.getByTestId('orders-filter-count-3').props.children).toBe(4)
    expect(screen.getByTestId('orders-filter-count-4').props.children).toBe(2)
  })

  it('кнопка «Готово» только закрывает уже применённый фильтр', async () => {
    await renderFilter()

    await fireEvent.press(screen.getByTestId('orders-filter-done'))

    expect(mockShowModalTypeDop).toHaveBeenCalledWith(false)
    expect(mockSetTypeDop).not.toHaveBeenCalled()
  })

  it('сброс включает все четыре статуса и оставляет модалку открытой', async () => {
    await renderFilter()

    await fireEvent.press(screen.getByTestId('orders-filter-reset'))

    expect(mockSetTypeDop).toHaveBeenCalledWith(['1', '2', '4', '3'])
    expect(mockShowModalTypeDop).not.toHaveBeenCalled()
  })

  it('оставляет заголовок, сброс и «Готово» вне прокрутки статусов', async () => {
    mockFilterLogic.globalFontSize = 26
    await renderFilter()

    const scroll = within(screen.getByTestId('orders-filter-sheet-scroll'))

    expect(scroll.getByText('В очереди')).toBeTruthy()
    expect(scroll.getByText('На сборке')).toBeTruthy()
    expect(scroll.queryByText('Активные заказы')).toBeNull()
    expect(scroll.queryByText('Какие статусы показывать')).toBeNull()
    expect(scroll.queryByTestId('orders-filter-reset')).toBeNull()
    expect(scroll.queryByTestId('orders-filter-done')).toBeNull()
    expect(screen.getByTestId('orders-filter-reset')).toHaveStyle({
      width: 44,
      height: 44,
      justifyContent: 'flex-start',
      paddingTop: 2,
    })
  })

  it('скрывает сброс, когда выбраны все статусы', async () => {
    mockFilterLogic.type_dop = ['1', '2', '4', '3']
    await renderFilter()

    expect(screen.queryByTestId('orders-filter-reset')).toBeNull()
  })

  it.each([
    ['светлой', lightAppPalette, false],
    ['тёмной', darkAppPalette, true],
  ] as const)('задаёт контрастные линии иконки сброса в %s теме', async (_name, colors, isDark) => {
    mockTheme = { colors, isDark }
    await renderFilter()

    expect(screen.getByTestId('orders-filter-reset-icon').props).toMatchObject({
      width: 26,
      height: 26,
      viewBox: '0 0 24 24',
    })
    expect(screen.getByTestId('orders-filter-reset-icon-path').props).toMatchObject({
      fill: 'none',
      stroke: colors.text,
      strokeWidth: 2,
    })
  })

  it('при размере 26 увеличивает текст и оставляет кнопкам автоматическую высоту', async () => {
    mockFilterLogic.globalFontSize = 26
    await renderFilter()

    expect(screen.getByText('Активные заказы')).toHaveStyle({ fontSize: 24 })
    expect(screen.getByText('Какие статусы показывать')).toHaveStyle({ fontSize: 18 })
    expect(screen.getByText('В очереди')).toHaveStyle({
      fontSize: 22,
      lineHeight: 28,
    })
    expect(screen.getByTestId('orders-filter-option-1')).not.toHaveStyle({ height: 44 })
  })

  it('закрывается через индикатор тем же store-действием', async () => {
    await renderFilter()

    await fireEvent.press(screen.getByTestId('orders-filter-sheet-handle'))
    expect(mockShowModalTypeDop).toHaveBeenCalledWith(false)
  })

  it('не рендерит шторку при закрытом состоянии', async () => {
    mockFilterLogic.is_showModalTypeDop = false
    await renderFilter()

    expect(screen.queryByTestId('orders-filter-sheet')).toBeNull()
  })
})
