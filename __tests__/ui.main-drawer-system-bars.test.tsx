import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';

const mockSystemBars = jest.fn();

let mockDrawerStatus: 'open' | 'closed' = 'closed';
let mockDrawerNavigatorProps: any;

const mockGlobalState = {
  globalFontSize: 16,
  is_need_avg_time: true,
  is_need_page_stat: false,
  setNotifToken: jest.fn(),
};

const mockOrdersState = {
  type: { id: 1, text: 'Активные' },
  getOrders: jest.fn(),
  types_dop: [] as Array<{ id: number }>,
  type_dop: [] as string[],
  showModalTypeDop: jest.fn(),
  prefetchOrders: jest.fn(async () => undefined),
  ordersContextKey: '',
  ordersCache: {},
  ordersPrefetchPaused: false,
  is_check: false,
};

const mockGeoState = {
  checkMyPos: jest.fn(),
};

jest.mock('@react-navigation/drawer', () => {
  const React = require('react');
  const { View } = require('react-native');

  const drawerContentProps = {
    state: {
      index: 0,
      routeNames: ['List_orders'],
      routes: [{ key: 'List_orders-key', name: 'List_orders' }],
    },
    navigation: {
      navigate: jest.fn(),
      closeDrawer: jest.fn(),
    },
    descriptors: {},
  };

  return {
    __esModule: true,
    useDrawerStatus: () => mockDrawerStatus,
    createDrawerNavigator: () => ({
      Navigator: ({ children, drawerContent, ...props }: any) => {
        mockDrawerNavigatorProps = props;
        return React.createElement(
          View,
          { testID: 'drawer-navigator' },
          drawerContent(drawerContentProps),
          children,
        );
      },
      Screen: () => null,
    }),
  };
});

jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: (props: any) => {
    mockSystemBars(props);
    return null;
  },
}));

jest.mock('@/shared/store/store', () => ({
  useGlobalStore: (selector: any) => selector(mockGlobalState),
  useOrdersStore: (selector: any) => selector(mockOrdersState),
  useGEOStore: (selector: any) => selector(mockGeoState),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

jest.mock('@/app/navigation/CustomDrawerContent', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    CustomDrawerContent: () =>
      React.createElement(View, { testID: 'custom-drawer-content' }),
  };
});

jest.mock('@fortawesome/react-native-fontawesome', () => ({
  FontAwesomeIcon: () => null,
}));

jest.mock('lucide-react-native', () => ({
  RefreshCcw: () => null,
}));

jest.mock('@fortawesome/free-solid-svg-icons', () => ({
  faBars: {},
  faFilter: {},
}));

jest.mock('@/shared/lib/useAvgTimeUpdater', () => ({
  useAvgTimeUpdater: jest.fn(),
}));

jest.mock('@/shared/lib/useSettingsUpdater', () => ({
  useSettingsUpdater: jest.fn(),
}));

jest.mock('@/shared/lib/useUserLocationUpdater', () => ({
  useUserLocationUpdater: jest.fn(),
}));

jest.mock('@/features/settings/ui/SettingsScreen', () => ({
  SettingsScreen: () => null,
}));
jest.mock('@/features/salary/ui/PriceScreen', () => ({
  PriceScreen: () => null,
}));
jest.mock('@/features/auth/ui/AuthScreen', () => ({
  AuthScreen: () => null,
}));
jest.mock('@/features/reset-pwd/ui/ResetPwdScreen', () => ({
  ResetPwdScreen: () => null,
}));
jest.mock('@/features/orders-list/ui/OrdersListScreen', () => ({
  OrdersListScreen: () => null,
}));
jest.mock('@/features/orders-map/ui/MapScreen', () => ({
  MapScreen: () => null,
}));
jest.mock('@/features/schedule/ui/GraphScreen', () => ({
  GraphScreen: () => null,
}));
jest.mock('@/features/statistics/ui/StatisticsTableScreen', () => ({
  StatisticsTableScreen: () => null,
}));
jest.mock('@/app/screens/Greeting', () => ({
  Greeting: () => null,
}));
jest.mock('@/features/feedback/ui/FeedbackScreen', () => ({
  FeedbackScreen: () => null,
}));

import { MainDrawerNavigator } from '@/app/navigation/MainDrawerNavigator';
import {ConnectivityContext} from '@/shared/lib/connectivityContext';
import {useOrderRecommendationStore} from '@/features/order-recommendation/model/orderRecommendation.store';

function setPlatform(os: 'android' | 'ios'): void {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
}

function latestSystemBarsProps(): any {
  return mockSystemBars.mock.calls[mockSystemBars.mock.calls.length - 1][0];
}

describe('системные области бокового меню', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDrawerStatus = 'closed';
    mockDrawerNavigatorProps = undefined;
    mockOrdersState.type = { id: 1, text: 'Активные' };
    mockOrdersState.types_dop = [];
    mockOrdersState.type_dop = [];
    useOrderRecommendationStore.getState().reset();
    setPlatform('android');
  });

  afterEach(async () => {
    await cleanup();
  });

  afterAll(() => {
    setPlatform(originalPlatform as 'android' | 'ios');
  });

  it('на Android скрывает Status Bar только при открытом drawer', async () => {
    mockDrawerStatus = 'open';

    const screen = await render(<MainDrawerNavigator />);

    expect(screen.getByTestId('custom-drawer-content')).toBeTruthy();
    expect(latestSystemBarsProps()).toEqual({
      hidden: { statusBar: true },
    });

    await cleanup();
    jest.clearAllMocks();
    mockDrawerStatus = 'closed';

    await render(<MainDrawerNavigator />);

    expect(latestSystemBarsProps()).toEqual({
      hidden: { statusBar: false },
    });
  });

  it('на iOS сохраняет нативное fade-поведение без Android SystemBars', async () => {
    setPlatform('ios');

    await render(<MainDrawerNavigator />);

    expect(mockSystemBars).not.toHaveBeenCalled();

    const options = mockDrawerNavigatorProps.screenOptions({
      navigation: { openDrawer: jest.fn() },
    });

    expect(options.drawerType).toBe('front');
    expect(options.drawerHideStatusBarOnOpen).toBe(true);
    expect(options.drawerStatusBarAnimation).toBe('fade');
  });

  it.each(['Map', 'List_orders'])('офлайн-плашка не меняет заголовок карты: %s', async routeName => {
    const view = await render(<MainDrawerNavigator />);
    const options = mockDrawerNavigatorProps.screenOptions({navigation: {openDrawer: jest.fn()}});
    await view.rerender(
      <ConnectivityContext.Provider value={true}>
        {options.header({options: {title: routeName}, route: {name: routeName}})}
      </ConnectivityContext.Provider>,
    );
    if (routeName === 'Map') {
      expect(view.queryByTestId('offline-status-banner')).toBeNull();
    } else {
      expect(view.getByTestId('offline-status-banner')).toBeTruthy();
    }
  });

  it('скрывает фильтр вне «Активных», сохраняя обновление заказов', async () => {
    mockOrdersState.type = { id: 2, text: 'Мои отмеченные' };
    const view = await render(<MainDrawerNavigator />);
    const options = mockDrawerNavigatorProps.screenOptions({navigation: {openDrawer: jest.fn()}});
    await view.rerender(options.headerRight());

    expect(view.queryByTestId('orders-status-filter')).toBeNull();
    await fireEvent.press(view.getByTestId('orders-refresh'));
    expect(mockOrdersState.getOrders).toHaveBeenCalledWith(true);
  });

  it.each([
    {selected: ['3']},
    {selected: ['1', '2', '3']},
  ])('в «Активных» отмечает частичный выбор $selected синим фоном без галочки', async ({selected}) => {
    mockOrdersState.types_dop = [{id: 1}, {id: 2}, {id: 4}, {id: 3}];
    mockOrdersState.type_dop = selected;
    const view = await render(<MainDrawerNavigator />);
    const options = mockDrawerNavigatorProps.screenOptions({navigation: {openDrawer: jest.fn()}});
    await view.rerender(options.headerRight());

    const filter = view.getByTestId('orders-status-filter');
    expect(filter.props.accessibilityState).toEqual({ selected: true });
    expect(view.getByTestId('orders-status-filter-background')).toHaveStyle({
      width: 32, height: 32, backgroundColor: '#2196F3', borderRadius: 8,
    });
    expect(view.queryByTestId('orders-status-filter-check')).toBeNull();
    await fireEvent.press(filter);
    expect(mockOrdersState.showModalTypeDop).toHaveBeenCalledWith(true);
  });

  it('при выборе всех четырёх статусов фильтр имеет прозрачный фон', async () => {
    mockOrdersState.types_dop = [{id: 1}, {id: 2}, {id: 4}, {id: 3}];
    mockOrdersState.type_dop = ['1', '2', '4', '3'];
    const view = await render(<MainDrawerNavigator />);
    const options = mockDrawerNavigatorProps.screenOptions({navigation: {openDrawer: jest.fn()}});
    await view.rerender(options.headerRight());

    const filter = view.getByTestId('orders-status-filter');
    expect(filter.props.accessibilityState).toEqual({selected: false});
    expect(view.getByTestId('orders-status-filter-background')).toHaveStyle({backgroundColor: 'transparent'});
  });

  it.each([
    {isLoading: true, result: null, isOpen: false, isRouteVisible: false},
    {isLoading: false, result: {st: true}, isOpen: true, isRouteVisible: true},
    {isLoading: false, result: {st: true}, isOpen: false, isRouteVisible: true},
    {isLoading: false, result: {st: true}, isOpen: false, isRouteVisible: false},
  ])('скрывает фильтр во время анализа или пока существует подборка: %o', async state => {
    useOrderRecommendationStore.setState(state);
    const view = await render(<MainDrawerNavigator />);
    const options = mockDrawerNavigatorProps.screenOptions({navigation: {openDrawer: jest.fn()}});
    await view.rerender(options.headerRight());
    expect(view.queryByTestId('orders-status-filter')).toBeNull();
    expect(view.getByTestId('orders-refresh')).toBeTruthy();
  });

  it('показывает фильтр, когда анализ завершён без подборки', async () => {
    useOrderRecommendationStore.setState({isLoading: false, result: null});
    const view = await render(<MainDrawerNavigator />);
    const options = mockDrawerNavigatorProps.screenOptions({navigation: {openDrawer: jest.fn()}});
    await view.rerender(options.headerRight());
    expect(view.getByTestId('orders-status-filter')).toBeTruthy();
  });
});
