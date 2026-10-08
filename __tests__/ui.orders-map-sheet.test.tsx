import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

const mockShowOrdersMap = jest.fn();
let mockLogic: any;
const mockSheetMount = jest.fn();
const mockSheetUnmount = jest.fn();
const mockSheetCallbacks: Array<() => void> = [];

jest.mock('@/features/orders-map/model/useModalOrderLogic', () => ({
  useModalOrderLogic: () =>
    mockLogic ??
    jest
      .requireActual('@/features/orders-map/model/useModalOrderLogic')
      .useModalOrderLogic(),
}));

jest.mock('@/entities/CardOrder/ui/CardOrder', () => {
  const React = require('react');
  const {View} = require('react-native');

  return {
    ORDER_CARD_DELETED_BG: '#D95030',
    CardOrder: ({item}: any) =>
      React.createElement(View, {
        testID: `map-order-card-${item.id}`,
      }),
  };
});

jest.mock('@/components/ui/actionsheet', () => {
  const React = require('react');
  const {ScrollView, View} = require('react-native');

  return {
    // A real Actionsheet retains its overlay while exiting. Keep the mocked
    // layer even when isOpen=false so this test detects hidden interceptors.
    Actionsheet: ({children, onClose}: any) => {
      React.useEffect(() => {
        mockSheetMount();
        return mockSheetUnmount;
      }, []);
      mockSheetCallbacks.push(onClose);
      return React.createElement(
        View,
        {testID: 'retained-sheet-overlay'},
        children,
      );
    },
    ActionsheetBackdrop: View,
    ActionsheetContent: View,
    ActionsheetDragIndicator: View,
    ActionsheetDragIndicatorWrapper: View,
    ActionsheetScrollView: ScrollView,
  };
});

jest.mock('react-native-yamap-plus', () => ({
  Marker: require('react-native').View,
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const {View} = require('react-native');

  return {
    ChevronLeft: (props: any) => React.createElement(View, props),
  };
});

import {ModalOrder} from '@/features/orders-map/ui/ModalOrder';
import {OrderMarker} from '@/features/orders-map/ui/OrderMarker';
import {useOrdersStore} from '@/shared/store/store';
import {setAppOffline} from '@/shared/lib/connectivityState';
import {ConnectivityContext} from '@/shared/lib/connectivityContext';
import * as ApiModule from '@/shared/store/api';

const metrics = {
  frame: {x: 0, y: 0, width: 390, height: 844},
  insets: {top: 47, right: 0, bottom: 34, left: 0},
};

async function renderSheet() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ModalOrder />
    </SafeAreaProvider>,
  );
}

describe('карточка заказа на карте', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSheetCallbacks.length = 0;
    mockLogic = {
      FormatPrice: (value: number) => String(value),
      globalFontSize: 16,
      showAlertText: jest.fn(),
      showOrders: [{id: 169340, is_delete: 0}],
      isOpenOrderMap: true,
      showOrdersMap: mockShowOrdersMap,
      actionButtonOrder: jest.fn(),
      setActiveConfirm: jest.fn(),
      dialCall: jest.fn(),
      isBusy: false,
      mapOrderSession: 1,
    };
  });

  it('открывается снизу, ограничена 75% и учитывает нижнюю Safe Area', async () => {
    await renderSheet();

    expect(screen.getByTestId('order-map-sheet')).toHaveStyle({
      maxHeight: '75%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: '#FFFFFF',
    });
    expect(
      screen.getByTestId('order-map-sheet-scroll').props.contentContainerStyle,
    ).toEqual({
      paddingBottom: 48,
    });
    expect(screen.getByTestId('map-order-card-169340')).toBeTruthy();

    fireEvent.press(screen.getByTestId('order-map-sheet-handle'));
    expect(mockShowOrdersMap).toHaveBeenCalledWith(-1, 1);
  });

  it('блокирует закрытие и показывает спинер во время действия', async () => {
    mockLogic.isBusy = true;
    await renderSheet();

    expect(screen.getByTestId('order-map-sheet-spinner')).toBeTruthy();
    fireEvent.press(screen.getByTestId('order-map-sheet-handle'));
    expect(mockShowOrdersMap).not.toHaveBeenCalled();
  });

  it('окрашивает всю шторку для удалённого заказа', async () => {
    mockLogic.showOrders = [{id: 169340, is_delete: 1}];
    await renderSheet();

    expect(screen.getByTestId('order-map-sheet')).toHaveStyle({
      backgroundColor: '#D95030',
    });
  });

  it('показывает компактную группу и открывает только выбранный заказ', async () => {
    mockLogic.showOrders = [
      {
        id: 900001,
        id_text: '#900001 В очереди 0%',
        addr: 'улица Ленина, 85',
        pd: '1',
        et: '5',
        kv: '12',
        point_text: '11:51 (48 мин.)',
        point_color: '#22A33A',
        is_delete: 0,
      },
      {
        id: 900002,
        id_text: '#900002 Готовится 0%',
        addr: 'улица Ленина, 85',
        pd: '2',
        et: '3',
        kv: '41',
        point_text: '11:38 (45 мин.)',
        point_color: '#CC0033',
        is_delete: 0,
      },
    ];

    await renderSheet();

    expect(screen.getByTestId('order-map-group-title')).toHaveTextContent(
      '2 заказа по адресу',
    );
    expect(screen.getByTestId('order-map-group-address')).toHaveTextContent(
      'улица Ленина, 85',
    );
    const groupRow = screen.getByTestId('order-map-group-order-900002');
    const groupRowStyle = StyleSheet.flatten(
      typeof groupRow.props.style === 'function'
        ? groupRow.props.style({pressed: false})
        : groupRow.props.style,
    );
    expect(groupRowStyle).toMatchObject({
      minHeight: 76,
      borderWidth: 1,
      borderRadius: 16,
      borderColor: 'rgba(66, 98, 125, 0.28)',
      backgroundColor: '#FFFFFF',
    });
    expect(screen.queryByTestId('map-order-card-900001')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByTestId('order-map-group-order-900002'));
    });

    expect(screen.getByTestId('map-order-card-900002')).toBeTruthy();
    expect(screen.queryByTestId('map-order-card-900001')).toBeNull();
    expect(screen.getByTestId('order-map-group-back-label')).toHaveTextContent(
      'Все заказы по адресу (2)',
    );
    expect(
      screen.getByTestId('order-map-group-back-arrow', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    const backButton = screen.getByTestId('order-map-group-back');
    const backButtonStyle = StyleSheet.flatten(
      typeof backButton.props.style === 'function'
        ? backButton.props.style({pressed: false})
        : backButton.props.style,
    );
    expect(backButtonStyle).toMatchObject({
      borderWidth: 1,
      borderRadius: 12,
      borderColor: 'rgba(66, 98, 125, 0.28)',
      backgroundColor: '#E9EEF3',
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('order-map-group-back'));
    });
    expect(screen.getByTestId('order-map-group-list')).toBeTruthy();
    expect(screen.queryByTestId('map-order-card-900002')).toBeNull();
  });

  it('не рендерится в закрытом состоянии', async () => {
    mockLogic.isOpenOrderMap = false;
    await renderSheet();

    expect(screen.queryByTestId('order-map-sheet')).toBeNull();
  });
});

it('полностью удаляет перехватывающий слой при закрытии', async () => {
  mockLogic = {
    FormatPrice: String,
    globalFontSize: 16,
    showAlertText: jest.fn(),
    showOrders: [{id: 1}],
    isOpenOrderMap: true,
    showOrdersMap: jest.fn(),
    actionButtonOrder: jest.fn(),
    setActiveConfirm: jest.fn(),
    dialCall: jest.fn(),
    isBusy: false,
    mapOrderSession: 1,
  };
  const probe = await renderSheet();
  expect(probe.getByTestId('retained-sheet-overlay')).toBeTruthy();
  mockLogic = {...mockLogic, isOpenOrderMap: false};
  await probe.rerender(
    <SafeAreaProvider initialMetrics={metrics}>
      <ModalOrder />
    </SafeAreaProvider>,
  );
  expect(probe.queryByTestId('retained-sheet-overlay')).toBeNull();
  expect(mockSheetUnmount).toHaveBeenCalled();
});

it('защищает повторное открытие от старого close callback, включая React batching', async () => {
  mockLogic = undefined;
  useOrdersStore.setState({
    isOpenOrderMap: false,
    mapOrderSession: 0,
    isClick: false,
    is_load: false,
    showOrders: [],
    orders: [{id: 1, addr: 'A', pd: '1'}] as any,
  });
  const probe = await renderSheet();
  await act(async () => {
    useOrdersStore.getState().showOrdersMap(1);
  });
  const oldClose = mockSheetCallbacks[mockSheetCallbacks.length - 1];
  const mounts = mockSheetMount.mock.calls.length;
  await act(async () => {
    oldClose();
    useOrdersStore.getState().showOrdersMap(1);
  });
  expect(mockSheetMount.mock.calls.length).toBe(mounts + 1);
  await act(async () => {
    oldClose();
  });
  expect(probe.getByTestId('order-map-sheet')).toBeTruthy();
  const currentClose = mockSheetCallbacks[mockSheetCallbacks.length - 1];
  await act(async () => {
    currentClose();
  });
  expect(probe.queryByTestId('retained-sheet-overlay')).toBeNull();
  await act(async () => {
    useOrdersStore.setState({
      orders: [],
      showOrders: [],
      isOpenOrderMap: false,
    });
  });
});

it('без сети открывает сохранённые заказы по метке и выдерживает 100 циклов быстрых нажатий/закрытий', async () => {
  mockLogic = undefined;
  const initial = useOrdersStore.getState();
  const api = jest.spyOn(ApiModule, 'api');
  const item = {id: 1, addr: 'A', pd: '1', xy: {lat: 53.2, lon: 50.1}} as any;
  setAppOffline(true);
  useOrdersStore.setState({
    orders: [item, {...item, id: 2}],
    showOrders: [],
    isOpenOrderMap: false,
    mapOrderSession: 0,
    isClick: false,
    is_load: false,
  });
  try {
    const probe = await render(
      <ConnectivityContext.Provider value={true}>
        <SafeAreaProvider initialMetrics={metrics}>
          <OrderMarker
            item={item}
            theme="white_border"
            globalFontSize={16}
            mapScale={1}
            showOrdersMap={useOrdersStore.getState().showOrdersMap}
            image={{
              signature: 'offline',
              source: {uri: 'data:image/png;base64,a'},
              width: 120,
              height: 30,
              anchor: {x: 10 / 120, y: 0.5},
            }}
          />
          <ModalOrder />
        </SafeAreaProvider>
      </ConnectivityContext.Provider>,
    );
    for (let i = 0; i < 100; ++i) {
      await fireEvent.press(probe.getByTestId('order-marker-1'));
      expect(probe.getByTestId('order-map-group-list')).toBeTruthy();
      await fireEvent.press(probe.getByTestId('order-map-group-order-1'));
      expect(probe.getByTestId('map-order-card-1')).toBeTruthy();
      expect(probe.queryByTestId('map-order-card-2')).toBeNull();
      const session = useOrdersStore.getState().mapOrderSession;
      const oldClose = mockSheetCallbacks[mockSheetCallbacks.length - 1];
      await act(async () => {
        const tap = probe.getByTestId('order-marker-1').props.onPress;
        for (let repeat = 0; repeat < 10; ++repeat) tap();
      });
      expect(useOrdersStore.getState().mapOrderSession).toBe(session);
      await fireEvent.press(probe.getByTestId('order-map-sheet-handle'));
      expect(probe.queryByTestId('retained-sheet-overlay')).toBeNull();
      await fireEvent.press(probe.getByTestId('order-marker-1'));
      await act(async () => {
        oldClose();
      });
      expect(probe.getByTestId('order-map-group-list')).toBeTruthy();
      await fireEvent.press(probe.getByTestId('order-map-sheet-handle'));
      expect(probe.queryByTestId('retained-sheet-overlay')).toBeNull();
    }
    expect(api).not.toHaveBeenCalled();
  } finally {
    setAppOffline(false);
    await act(async () => {
      useOrdersStore.setState(initial);
    });
    api.mockRestore();
  }
});
