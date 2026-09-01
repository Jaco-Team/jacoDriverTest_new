const mockRequest = jest.fn();
const mockCheckMultiple = jest.fn();
const mockGetCurrentPosition = jest.fn();
const mockWatchPosition = jest.fn();
const mockClearWatch = jest.fn();
const mockAnalyticsLog = jest.fn();

jest.mock('react-native-permissions', () => ({
  request: (...args: any[]) => mockRequest(...args),
  checkMultiple: (...args: any[]) => mockCheckMultiple(...args),
  PERMISSIONS: {
    IOS: { LOCATION_WHEN_IN_USE: 'ios.location_when_in_use' },
    ANDROID: { ACCESS_FINE_LOCATION: 'android.access_fine_location' },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
  },
}));

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: (...args: any[]) => mockGetCurrentPosition(...args),
    watchPosition: (...args: any[]) => mockWatchPosition(...args),
    clearWatch: (...args: any[]) => mockClearWatch(...args),
  },
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: (...args: any[]) => mockAnalyticsLog(...args) },
  AnalyticsEvent: {
    DriverLocation: 'DriverLocation',
  },
}));

import { useGEOStore, useGlobalStore, useOrdersStore } from '@/shared/store/store';

describe('useGEOStore location flow', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockRequest.mockResolvedValue('granted');

    useGlobalStore.setState({
      loadSpinner: true,
      is_show_modal_text: false,
      modal_text: '',
    });
    useOrdersStore.setState({
      driver_need_gps: false,
    });
    useGEOStore.setState({
      check_pos_check: false,
      driver_location_requesting: false,
      location_driver: null,
      location_driver_time_text: '',
      type_location: 'none',
      id_watch: null,
    });
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('check_pos: при разрешенной геолокации передает координаты в callback', async () => {
    const payload = { order_id: 123 };
    const callback = jest.fn();

    mockGetCurrentPosition.mockImplementationOnce((success) => {
      success({
        mocked: false,
        coords: {
          latitude: 54.7104,
          longitude: 20.4522,
          accuracy: 8,
        },
      });
    });

    await useGEOStore.getState().check_pos(callback, payload);

    expect(mockRequest).toHaveBeenCalledWith(
      'ios.location_when_in_use',
      expect.objectContaining({
        title: 'Жако Курьер',
        message: 'Геолокация нужна в момент завершения заказа',
      }),
    );
    expect(mockGetCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        maximumAge: 3000,
        enableHighAccuracy: true,
      },
    );
    expect(callback).toHaveBeenCalledWith({
      latitude: 54.7104,
      longitude: 20.4522,
      data: payload,
      accuracy: 8,
    });
    expect(useGlobalStore.getState().is_show_modal_text).toBe(false);
  });

  it('check_pos: при запрете разрешения показывает ошибку и гасит spinner по таймеру', async () => {
    const callback = jest.fn();
    mockRequest.mockResolvedValueOnce('blocked');

    await useGEOStore.getState().check_pos(callback, {});

    expect(callback).not.toHaveBeenCalled();
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().is_show_modal_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe('Вы запретили отслеживание геолокации');
    expect(useGlobalStore.getState().loadSpinner).toBe(true);

    jest.advanceTimersByTime(300);

    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('check_pos: при mocked location не вызывает callback и показывает защитную ошибку', async () => {
    const callback = jest.fn();

    mockGetCurrentPosition.mockImplementationOnce((success) => {
      success({
        mocked: true,
        coords: {
          latitude: 54.7,
          longitude: 20.4,
          accuracy: 10,
        },
      });
    });

    await useGEOStore.getState().check_pos(callback, {});

    expect(callback).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().is_show_modal_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe(
      'Не удалось определить местоположение. Возможно, данные были подменены.',
    );

    jest.advanceTimersByTime(300);

    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('check_pos: при ошибке GPS показывает текст ошибки и гасит spinner', async () => {
    const callback = jest.fn();

    mockGetCurrentPosition.mockImplementationOnce((_success, error) => {
      error({ message: 'timeout' });
    });

    await useGEOStore.getState().check_pos(callback, {});

    expect(callback).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().is_show_modal_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe(
      'Не удалось определить местоположение. timeout',
    );

    jest.advanceTimersByTime(300);

    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('check_pos_fake: отдает нулевые координаты и завершает spinner по таймеру', async () => {
    const payload = { order_id: 456 };
    const callback = jest.fn();

    useGEOStore.getState().check_pos_fake(callback, payload);

    expect(callback).toHaveBeenCalledWith({
      latitude: 0,
      longitude: 0,
      data: payload,
      accuracy: 0,
    });
    expect(useGlobalStore.getState().loadSpinner).toBe(true);

    jest.advanceTimersByTime(300);

    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('MyCurrentLocation: запускает watchPosition и сохраняет текущую позицию', async () => {
    mockWatchPosition.mockImplementationOnce((success) => {
      success({
        mocked: false,
        coords: {
          latitude: 55.1,
          longitude: 37.9,
          accuracy: 12,
        },
      });
      return 77;
    });

    await useGEOStore.getState().MyCurrentLocation();

    expect(mockWatchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        maximumAge: 3000,
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
    expect(useGEOStore.getState().id_watch).toBe(77);
    expect(useGEOStore.getState().location_driver).toEqual({
      lon: 37.9,
      lat: 55.1,
      accuracy: 12,
    });
    expect(useGEOStore.getState().location_driver_time_text).toMatch(/^\d{1,2}:\d{2}$/);
  });

  it('set_type_location: после таймаута точного GPS использует сохранённую позицию', async () => {
    mockGetCurrentPosition
      .mockImplementationOnce((_success, error) => {
        error({ code: 3, message: 'Location request timed out' });
      })
      .mockImplementationOnce((success) => {
        success({
          mocked: false,
          coords: {
            latitude: 53.529781,
            longitude: 49.40071,
            accuracy: 25,
          },
        });
      });

    await useGEOStore.getState().set_type_location();

    expect(mockGetCurrentPosition).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
    expect(mockGetCurrentPosition).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
    expect(useGEOStore.getState().type_location).toBe('location');
    expect(useGEOStore.getState().location_driver).toEqual({
      lon: 49.40071,
      lat: 53.529781,
    });
  });

  it('set_type_location: не переключает режим, если обе попытки завершились ошибкой', async () => {
    mockGetCurrentPosition.mockImplementation((_success, error) => {
      error({ code: 3, message: 'Location request timed out' });
    });

    await useGEOStore.getState().set_type_location();

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(2);
    expect(useGEOStore.getState().type_location).toBe('none');
    expect(useGEOStore.getState().location_driver).toBeNull();
    expect(useGlobalStore.getState().modal_text).toContain(
      'Местоположение определяется слишком долго',
    );
    expect(useGlobalStore.getState().modal_text).not.toContain('Location request timed out');
  });

  it('set_type_location: из watch режима очищает watcher и сбрасывает состояние', async () => {
    useGEOStore.setState({
      type_location: 'watch',
      id_watch: 77,
      location_driver: { lon: 37.9, lat: 55.1, accuracy: 12 },
      location_driver_time_text: '10:05',
    });

    useGEOStore.getState().set_type_location();

    expect(mockClearWatch).toHaveBeenCalledWith(77);
    expect(useGEOStore.getState().type_location).toBe('none');
    expect(useGEOStore.getState().location_driver).toBeNull();
    expect(useGEOStore.getState().location_driver_time_text).toBe('');
    expect(useGEOStore.getState().id_watch).toBe(77);

    jest.advanceTimersByTime(300);

    expect(useGEOStore.getState().id_watch).toBeNull();
  });
});
