import React from 'react';
import { act, render } from '@testing-library/react-native';
import { BackHandler, Platform, Text } from 'react-native';

const mockGetCurrentRoute = jest.fn();
const mockIsReady = jest.fn();
const mockSystemBars = jest.fn();

let mockLoadSpinner = false;
let mockNavigationContainerProps: any;
let hardwareBackPressHandler: (() => boolean) | undefined;

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const { View } = require('react-native');

  const NavigationContainer = React.forwardRef((props: any, _ref: any) => {
    mockNavigationContainerProps = props;
    return React.createElement(
      View,
      { testID: 'navigation-container' },
      props.children,
    );
  });

  return {
    __esModule: true,
    DefaultTheme: {
      dark: false,
      colors: { background: '#FFFFFF' },
    },
    NavigationContainer,
    createNavigationContainerRef: () => ({
      getCurrentRoute: (...args: any[]) => mockGetCurrentRoute(...args),
      isReady: (...args: any[]) => mockIsReady(...args),
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
  useGlobalStore: (selector: any) => selector({ loadSpinner: mockLoadSpinner }),
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: {
    log: jest.fn(),
    setErrorContext: jest.fn(),
  },
  AnalyticsEvent: { ScreenOpen: 'ScreenOpen' },
}));

jest.mock('@/components/ui/center', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Center: ({ children }: any) =>
      React.createElement(View, { testID: 'spinner-overlay' }, children),
  };
});

jest.mock('@/components/ui/spinner', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Spinner: () => React.createElement(View, { testID: 'global-spinner' }),
  };
});

import {
  NavigationProvider,
  useActiveRouteName,
} from '@/app/providers/NavigationProvider';
import { CustomSpinner } from '@/shared/ui/CustomSpinner';

function RouteProbe(): React.JSX.Element {
  const routeName = useActiveRouteName();

  return <Text testID="active-route">{routeName}</Text>;
}

function latestSystemBarsProps(): any {
  return mockSystemBars.mock.calls[mockSystemBars.mock.calls.length - 1][0];
}

function setPlatform(os: 'android' | 'ios'): void {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
}

describe('NavigationProvider и системные области', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadSpinner = false;
    mockNavigationContainerProps = undefined;
    mockGetCurrentRoute.mockReturnValue({ name: 'Greeting' });
    mockIsReady.mockReturnValue(true);
    hardwareBackPressHandler = undefined;
    (BackHandler.addEventListener as jest.Mock).mockImplementation(
      (_eventName: string, handler: () => boolean) => {
        hardwareBackPressHandler = handler
        return { remove: jest.fn() }
      },
    );
    setPlatform('android');
  });

  afterAll(() => {
    setPlatform(originalPlatform as 'android' | 'ios');
  });

  it('оставляет красный фон и скрывает общий spinner на Greeting', async () => {
    mockLoadSpinner = true;

    const screen = await render(
      <NavigationProvider>
        <RouteProbe />
        <CustomSpinner />
      </NavigationProvider>,
    );

    expect(screen.getByTestId('active-route').props.children).toBe('Greeting');
    expect(screen.queryByTestId('global-spinner')).toBeNull();
    expect(mockNavigationContainerProps.theme.colors.background).toBe('#CC0033');
    expect(latestSystemBarsProps()).toEqual({
      style: { statusBar: 'light', navigationBar: 'dark' },
    });
  });

  it('блокирует системный back только на техническом Greeting', async () => {
    await render(
      <NavigationProvider>
        <RouteProbe />
      </NavigationProvider>,
    );

    expect(hardwareBackPressHandler?.()).toBe(true);

    mockGetCurrentRoute.mockReturnValue({ name: 'Auth' });
    expect(hardwareBackPressHandler?.()).toBe(false);

    mockIsReady.mockReturnValue(false);
    expect(hardwareBackPressHandler?.()).toBe(false);
  });

  it('переключает фон и стиль Status Bar между Auth и рабочими экранами', async () => {
    mockGetCurrentRoute.mockReturnValue({ name: 'Auth' });

    const screen = await render(
      <NavigationProvider>
        <RouteProbe />
      </NavigationProvider>,
    );

    await act(async () => {
      mockNavigationContainerProps.onReady();
    });

    expect(screen.getByTestId('active-route').props.children).toBe('Auth');
    expect(mockNavigationContainerProps.theme.colors.background).toBe('#F4F7FA');
    expect(latestSystemBarsProps()).toEqual({
      style: { statusBar: 'dark', navigationBar: 'dark' },
    });

    await act(async () => {
      mockNavigationContainerProps.onStateChange({
        index: 0,
        routes: [
          {
            name: 'Root',
            state: {
              index: 0,
              routes: [{ name: 'List_orders' }],
            },
          },
        ],
      });
    });

    expect(screen.getByTestId('active-route').props.children).toBe('List_orders');
    expect(mockNavigationContainerProps.theme.colors.background).toBe('#CC0033');
    expect(latestSystemBarsProps()).toEqual({
      style: { statusBar: 'light', navigationBar: 'dark' },
    });
  });

  it('показывает общий spinner после Greeting и сохраняет светлые системные иконки', async () => {
    mockLoadSpinner = true;
    mockGetCurrentRoute.mockReturnValue({ name: 'Auth' });

    const screen = await render(
      <NavigationProvider>
        <CustomSpinner />
      </NavigationProvider>,
    );

    await act(async () => {
      mockNavigationContainerProps.onReady();
    });

    expect(screen.getByTestId('global-spinner')).toBeTruthy();
    expect(latestSystemBarsProps()).toEqual({
      style: { statusBar: 'light', navigationBar: 'dark' },
    });
  });

  it('централизованно задаёт Status Bar на iOS', async () => {
    setPlatform('ios');
    mockGetCurrentRoute.mockReturnValue({ name: 'Auth' });

    await render(
      <NavigationProvider>
        <RouteProbe />
      </NavigationProvider>,
    );

    await act(async () => {
      mockNavigationContainerProps.onReady();
    });

    expect(latestSystemBarsProps()).toEqual({
      style: { statusBar: 'dark', navigationBar: 'dark' },
    });
  });
});
