import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockGetSettings = jest.fn();
const mockGetOrders = jest.fn();
const mockActionButtonOrder = jest.fn();
const mockSetActiveConfirm = jest.fn();
const mockShowAlertText = jest.fn();
const mockFormatPrice = jest.fn((price: number) => String(price));

let mockStatState: any;
let mockGlobalState: any;
let mockOrdersState: any;
let mockSettingsState: any;

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: any) => {
      React.useEffect(() => (typeof callback === 'function' ? callback() : undefined), [callback]);
    },
  };
});

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

jest.mock('@/shared/store/store', () => ({
  useStatStore: (selector: any) => selector(mockStatState),
  useGlobalStore: (selector: any) => selector(mockGlobalState),
  useOrdersStore: (selector: any) => selector(mockOrdersState),
  useSettingsStore: (selector: any) => selector(mockSettingsState),
}));

import { useOrdersList } from '@/features/orders-list/model/useOrdersList';
import { useTypeLimit } from '@/features/orders-list/model/useTypeLimit';

describe('orders-list hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatState = {
      FormatPrice: mockFormatPrice,
    };
    mockGlobalState = {
      globalFontSize: 18,
      showAlertText: mockShowAlertText,
    };
    mockOrdersState = {
      getOrders: mockGetOrders,
      orders: [{ id: 1, addr: 'Адрес' }],
      update_interval: 30,
      actionButtonOrder: mockActionButtonOrder,
      setActiveConfirm: mockSetActiveConfirm,
      limit_summ: '10000',
      limit_count: '10',
    };
    mockSettingsState = {
      getSettings: mockGetSettings,
    };
  });

  it('useOrdersList: возвращает store handlers и вызывает getSettings на mount/focus', async () => {
    let api: ReturnType<typeof useOrdersList> | null = null;

    function Probe() {
      api = useOrdersList();
      return null as any;
    }

    render(<Probe />);

    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    expect(mockGetSettings).toHaveBeenCalledTimes(2);
    expect(api!.FormatPrice).toBe(mockFormatPrice);
    expect(api!.globalFontSize).toBe(18);
    expect(api!.showAlertText).toBe(mockShowAlertText);
    expect(api!.getOrders).toBe(mockGetOrders);
    expect(api!.orders).toEqual([{ id: 1, addr: 'Адрес' }]);
    expect(api!.update_interval).toBe(30);
    expect(api!.actionButtonOrder).toBe(mockActionButtonOrder);
    expect(api!.setActiveConfirm).toBe(mockSetActiveConfirm);
  });

  it('useTypeLimit: возвращает лимиты, getOrders и размер шрифта', () => {
    let api: ReturnType<typeof useTypeLimit> | null = null;

    function Probe() {
      api = useTypeLimit();
      return null as any;
    }

    render(<Probe />);

    expect(api!.getOrders).toBe(mockGetOrders);
    expect(api!.limit_summ).toBe('10000');
    expect(api!.limit_count).toBe('10');
    expect(api!.globalFontSize).toBe(18);
  });
});
