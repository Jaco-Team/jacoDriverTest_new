import React from 'react';
import { cleanup, render } from '@testing-library/react-native';
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
  getOrders: jest.fn(),
  types_dop: [],
  type_dop: [],
  showModalTypeDop: jest.fn(),
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
});
