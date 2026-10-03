import { waitFor } from '@testing-library/react-native';

const mockApi = jest.fn();

jest.mock('@/shared/store/api', () => ({
  api: (...args: any[]) => mockApi(...args),
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: jest.fn(), init: jest.fn() },
  AnalyticsEvent: {},
}));

import {
  useGlobalStore,
  useOrdersStore,
  useSettingsStore,
} from '@/shared/store/store';
import {useAppThemeStore} from '@/shared/theme/AppThemeProvider';

describe('useSettingsStore.getSettings', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useGlobalStore.setState({
      tokenAuth: 'test-token',
      globalFontSize: 16,
      mapScale: 1,
      theme: 'white',
      is_need_avg_time: true,
      is_need_page_stat: true,
      phones: null,
      loadSpinner: false,
    });
    useOrdersStore.setState({
      update_interval: 30,
    });
    useSettingsStore.setState({
      fontSize: 16,
      mapScale: 1,
      theme: 'white_border',
      update_interval: 30,
      driver_avg_time: true,
      driver_page_stat_time: true,
      phones: null,
    } as any);
  });

  it('парсит fontSize/mapScale tolerant-способом и обновляет связанные global/order store', async () => {
    mockApi
      .mockResolvedValueOnce({
        st: true,
        text: '',
        data: {
          action_centered_map: 1,
          color: '#cc0033',
          fontSize: '18px',
          mapScale: '1.4x',
          theme: 'black',
          type_data_map: 'full',
          type_show_del: 'min',
          update_interval: 45,
          driver_avg_time: 0,
          driver_page_stat_time: 1,
          night_map: 1,
          app_theme: 'light',
          is_scaleMap: 1,
          point_id: 15,
          all_points: [{ id: 15, name: 'Самара, Металлургов 76А' }],
        },
      })
      .mockResolvedValueOnce({
        st: true,
        text: '',
        data: {
          phone: {
            phone_center: '+70000000000',
            phone_man: '+71111111111',
            phone_upr: '+72222222222',
          },
        },
      })
      .mockResolvedValueOnce({st: true, text: '', data: {orders: []}});

    await useSettingsStore.getState().getSettings();

    expect(mockApi).toHaveBeenNthCalledWith(1, 'settings', {
      type: 'getMySetting',
      token: 'test-token',
    });
    expect(mockApi).toHaveBeenNthCalledWith(2, 'settings', {
      type: 'get_point_phone',
      token: 'test-token',
      point_id: 15,
    });

    expect(useGlobalStore.getState().globalFontSize).toBe(18);
    expect(useGlobalStore.getState().mapScale).toBe(1.4);
    expect(useGlobalStore.getState().theme).toBe('black');
    expect(useGlobalStore.getState().is_need_avg_time).toBe(false);
    expect(useGlobalStore.getState().is_need_page_stat).toBe(true);
    expect(useOrdersStore.getState().update_interval).toBe(45);
    expect(useAppThemeStore.getState().preference).toBe('light');
    expect(useSettingsStore.getState().point_id).toBe(15);
    expect(useSettingsStore.getState().points).toEqual([
      { id: 15, name: 'Самара, Металлургов 76А' },
    ]);
    await waitFor(() => {
      expect(useGlobalStore.getState().phones).toEqual({
        phone_center: '+70000000000',
        phone_man: '+71111111111',
        phone_upr: '+72222222222',
      });
      expect(mockApi).toHaveBeenCalledWith(
        'orders',
        expect.objectContaining({type: 'get_orders', point_id: 15}),
      );
    });
  });

  it('не применяет ответ старой сессии после выхода', async () => {
    let completeRequest!: (value: unknown) => void;
    mockApi.mockImplementationOnce(() => new Promise(resolve => {
      completeRequest = resolve;
    }));
    useAppThemeStore.setState({preference: 'system'});

    const request = useSettingsStore.getState().getSettings(true);
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1));
    useGlobalStore.setState({tokenAuth: ''});
    completeRequest({st: true, data: {app_theme: 'dark'}});
    await request;

    expect(useAppThemeStore.getState().preference).toBe('system');
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('при ошибке фонового обновления оставляет сохранённую тему', async () => {
    useAppThemeStore.setState({preference: 'dark'});
    mockApi.mockResolvedValueOnce({st: false, text: 'Нет сети'});

    await useSettingsStore.getState().getSettings(true);

    expect(useAppThemeStore.getState().preference).toBe('dark');
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });
});
