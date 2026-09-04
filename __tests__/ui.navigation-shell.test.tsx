import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

const mockNavigate = jest.fn()
const mockReset = jest.fn()
const mockCloseDrawer = jest.fn()
const mockLogOut = jest.fn()
const mockDialCall = jest.fn()
const mockAnalyticsLog = jest.fn()

let mockGlobalState: any

jest.mock('lucide-react-native', () => {
  const React = require('react')
  const Icon = () => React.createElement(React.Fragment)

  return {
    BriefcaseBusiness: Icon,
    Calculator: Icon,
    ChartNoAxesCombined: Icon,
    ChartSpline: Icon,
    CircleAlert: Icon,
    Clock3: Icon,
    Headphones: Icon,
    ListOrdered: Icon,
    LogOut: Icon,
    Map: Icon,
    Menu: Icon,
    RefreshCcw: Icon,
    Settings: Icon,
    SlidersHorizontal: Icon,
    UserRoundCog: Icon,
  }
})

jest.mock('@/shared/store/store', () => ({
  useGlobalStore: (selector: any) => selector(mockGlobalState),
  useLoginStore: (selector: any) => selector({ logogout: mockLogOut }),
}))

jest.mock('@/shared/lib/useDialCall', () => ({
  useDialCall: () => mockDialCall,
}))

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: (...args: any[]) => mockAnalyticsLog(...args) },
  AnalyticsEvent: {
    ScreenOpen: 'ScreenOpen',
    DrawerCallDirector: 'DrawerCallDirector',
    DrawerCallManager: 'DrawerCallManager',
    DrawerCallContactCenter: 'DrawerCallContactCenter',
  },
}))

import { CustomDrawerContent } from '@/app/navigation/CustomDrawerContent'

function drawerProps(activeRoute = 'List_orders'): any {
  return {
    state: {
      stale: false,
      type: 'drawer',
      key: 'drawer-test',
      index: 0,
      routeNames: [activeRoute],
      routes: [{ key: `${activeRoute}-key`, name: activeRoute }],
      history: [],
      default: 'closed',
    },
    navigation: {
      navigate: mockNavigate,
      reset: mockReset,
      closeDrawer: mockCloseDrawer,
    },
    descriptors: {},
  }
}

describe('боковое меню', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGlobalState = {
      globalFontSize: 16,
      phones: {
        phone_upr: '89001234567',
        phone_man: '',
        phone_center: '88463004653',
      },
      is_need_avg_time: true,
      is_need_page_stat: false,
      avgTime: '00:31:20',
    }
  })

  it('показывает активный раздел и скрывает статистику без разрешения API', async () => {
    const screen = await render(
      <CustomDrawerContent {...drawerProps('List_orders')} />,
    )

    expect(screen.getAllByText('Список заказов')).toHaveLength(2)
    expect(screen.getByText('00:31:20')).toBeTruthy()
    const selectedRoute = screen.getByTestId('drawer-route-List_orders')
    expect(selectedRoute.props.accessibilityState).toEqual({ selected: true })
    expect(selectedRoute).toHaveStyle({
      minHeight: 60,
      flexDirection: 'row',
      borderWidth: 1,
      backgroundColor: '#E9EEF3',
    })
    expect(screen.queryByTestId('drawer-route-Statistics')).toBeNull()
    expect(screen.getByTestId('drawer-route-OrdersUiPreview')).toBeTruthy()
    expect(screen.getByText('+7 (900) 123-45-67')).toBeTruthy()
    expect(screen.getByTestId('drawer-contact-Директор')).toHaveStyle({
      minHeight: 60,
      flexDirection: 'row',
      borderWidth: 1,
      backgroundColor: '#FFFFFF',
    })
    expect(screen.queryByTestId('drawer-contact-Контакт-центр')).toBeNull()
  })

  it('показывает статистику только при разрешении API', async () => {
    mockGlobalState.is_need_page_stat = true

    const screen = await render(
      <CustomDrawerContent {...drawerProps('List_orders')} />,
    )

    expect(screen.getByTestId('drawer-route-Statistics')).toBeTruthy()
  })

  it('сохраняет переходы, звонок и выход', async () => {
    const screen = await render(
      <CustomDrawerContent {...drawerProps('List_orders')} />,
    )

    await fireEvent.press(screen.getByTestId('drawer-route-Price'))
    expect(mockNavigate).toHaveBeenCalledWith('Price')
    expect(mockCloseDrawer).toHaveBeenCalled()

    mockCloseDrawer.mockClear()
    await fireEvent.press(screen.getByTestId('drawer-contact-Директор'))
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'DrawerCallDirector',
      'Звонок директору',
    )
    expect(mockDialCall).toHaveBeenCalledWith('89001234567')
    expect(mockCloseDrawer).toHaveBeenCalled()

    mockCloseDrawer.mockClear()
    await fireEvent.press(screen.getByTestId('drawer-logout'))
    expect(mockLogOut).toHaveBeenCalledTimes(1)
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Auth' }],
    })
    expect(mockCloseDrawer).toHaveBeenCalled()
  })

})
