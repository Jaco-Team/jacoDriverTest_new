import { renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

const mockGetOrders = jest.fn();
let mockIsClick = false;
let mockOffline = false;

jest.mock('@/shared/store/store', () => ({
  useOrdersStore: {
    getState: () => ({ getOrders: mockGetOrders, isClick: mockIsClick }),
  },
}));

jest.mock('@/shared/lib/connectivityState', () => ({
  isAppOffline: () => mockOffline,
}));

import { useOrdersRefreshOnForeground } from '@/shared/lib/useOrdersRefreshOnForeground';

describe('useOrdersRefreshOnForeground', () => {
  let listener: ((state: string) => void) | null;
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsClick = false;
    mockOffline = false;
    listener = null;
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler: any) => {
      listener = handler;
      return { remove } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('как на сайте: обновляет заказы, когда приложение вернулось из фона', async () => {
    await renderHook(() => useOrdersRefreshOnForeground(true));

    listener?.('background');
    expect(mockGetOrders).not.toHaveBeenCalled();

    listener?.('active');
    expect(mockGetOrders).toHaveBeenCalledTimes(1);
    expect(mockGetOrders).toHaveBeenCalledWith(false);
  });

  it('не обновляет без сети, во время действия с заказом и без возврата из фона', async () => {
    await renderHook(() => useOrdersRefreshOnForeground(true));

    listener?.('active');
    mockOffline = true;
    listener?.('background');
    listener?.('active');
    mockOffline = false;
    mockIsClick = true;
    listener?.('inactive');
    listener?.('active');

    expect(mockGetOrders).not.toHaveBeenCalled();
  });

  it('не подписывается на неактивном экране и отписывается при размонтировании', async () => {
    await renderHook(() => useOrdersRefreshOnForeground(false));
    expect(AppState.addEventListener).not.toHaveBeenCalled();

    const { unmount } = await renderHook(() => useOrdersRefreshOnForeground(true));
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
