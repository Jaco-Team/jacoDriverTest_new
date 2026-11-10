import { waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  useLoginStore,
  useOrdersStore,
  useSettingsStore,
} from '@/shared/store/store';

const asyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

function settingsResponse(data: Record<string, unknown>) {
  return { st: true, text: '', data: { all_points: [], ...data } };
}

describe('флаги меню «Среднее время» и «Статистика»', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.mockResolvedValue({ st: true, text: '', data: {} });
    asyncStorage.getItem.mockResolvedValue(null);
    useLoginStore.setState({ currentUser: null });
    useGlobalStore.setState({
      tokenAuth: 'test-token',
      is_need_avg_time: true,
      is_need_page_stat: true,
    });
    useOrdersStore.setState({ switchPoint: jest.fn() } as any);
    useSettingsStore.setState({ isClick: false, point_id: 1, points: [] } as any);
  });

  it('при смене кафе запрашивает настройки этого кафе и обновляет только флаги', async () => {
    mockApi.mockImplementation((module: string, data: any) =>
      Promise.resolve(
        module === 'settings' && data.type === 'getMySetting'
          ? settingsResponse({ point_id: 1, driver_avg_time: 0, driver_page_stat_time: 0 })
          : { st: true, text: '', data: {} },
      ),
    );

    useSettingsStore.getState().setPointId(2);

    await waitFor(() => expect(useGlobalStore.getState().is_need_avg_time).toBe(false));
    expect(mockApi).toHaveBeenCalledWith('settings', { type: 'getMySetting', point_id: 2 });
    expect(useGlobalStore.getState().is_need_page_stat).toBe(false);
    expect(useSettingsStore.getState().point_id).toBe(2);
  });

  it('не перезапрашивает флаги, если кафе не изменилось', async () => {
    useSettingsStore.getState().setPointId(1);
    await Promise.resolve();

    expect(mockApi).not.toHaveBeenCalledWith('settings', expect.objectContaining({ type: 'getMySetting' }));
  });

  it('игнорирует ответ для ранее выбранного кафе', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    mockApi
      .mockReturnValueOnce(new Promise(resolve => (resolveFirst = resolve)))
      .mockResolvedValueOnce(settingsResponse({ driver_avg_time: 1, driver_page_stat_time: 1 }));

    const first = useSettingsStore.getState().refreshMenuFlags(2);
    await useSettingsStore.getState().refreshMenuFlags(1);
    resolveFirst(settingsResponse({ driver_avg_time: 0, driver_page_stat_time: 0 }));
    await first;

    expect(useGlobalStore.getState().is_need_avg_time).toBe(true);
    expect(useGlobalStore.getState().is_need_page_stat).toBe(true);
  });

  it('как на сайте: без флагов в ответе состояние меню не меняется', async () => {
    useGlobalStore.setState({ is_need_avg_time: false, is_need_page_stat: true });
    mockApi.mockResolvedValueOnce(settingsResponse({ point_id: 1 }));

    await useSettingsStore.getState().refreshMenuFlags(1);

    expect(useGlobalStore.getState().is_need_avg_time).toBe(false);
    expect(useGlobalStore.getState().is_need_page_stat).toBe(true);
  });

  it('обычное обновление настроек запрашивает флаги выбранного кафе, а не домашнего', async () => {
    useSettingsStore.setState({ point_id: 2 } as any);
    mockApi.mockImplementation((module: string, data: any) =>
      Promise.resolve(
        module === 'settings' && data.type === 'getMySetting'
          ? settingsResponse({
              // settings.point_id — домашняя точка, флаги — запрошенного кафе.
              point_id: 1,
              all_points: [{ id: 1 }, { id: 2 }],
              driver_avg_time: 0,
              driver_page_stat_time: 1,
            })
          : { st: true, text: '', data: {} },
      ),
    );

    await useSettingsStore.getState().getSettings(true);

    expect(mockApi).toHaveBeenCalledWith('settings', {
      type: 'getMySetting',
      token: 'test-token',
      point_id: 2,
    });
    expect(useSettingsStore.getState().point_id).toBe(2);
    expect(useGlobalStore.getState().is_need_avg_time).toBe(false);
    expect(useGlobalStore.getState().is_need_page_stat).toBe(true);
  });

  it('после запуска берёт сохранённое кафе для первого же запроса настроек', async () => {
    useSettingsStore.setState({ point_id: null } as any);
    asyncStorage.getItem.mockResolvedValue('2');
    mockApi.mockResolvedValue(
      settingsResponse({ point_id: 1, all_points: [{ id: 1 }, { id: 2 }], driver_avg_time: 1, driver_page_stat_time: 0 }),
    );

    await useSettingsStore.getState().getSettings(true);

    expect(mockApi).toHaveBeenCalledWith('settings', expect.objectContaining({ type: 'getMySetting', point_id: 2 }));
    expect(useSettingsStore.getState().point_id).toBe(2);
    expect(useGlobalStore.getState().is_need_page_stat).toBe(false);
  });

  it('не применяет флаги чужого кафе, если кафе сменили во время запроса', async () => {
    let resolveSettings: (value: unknown) => void = () => undefined;
    mockApi.mockImplementation((module: string, data: any) => {
      if (module !== 'settings' || data.type !== 'getMySetting') {
        return Promise.resolve({ st: true, text: '', data: {} });
      }
      // Первый запрос — обычное обновление для кафе 1, остальные — флаги кафе 2.
      if (data.token) return new Promise(resolve => (resolveSettings = resolve));

      return Promise.resolve(settingsResponse({ driver_avg_time: 1, driver_page_stat_time: 0 }));
    });

    const pending = useSettingsStore.getState().getSettings(true);
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith('settings', expect.objectContaining({ token: 'test-token', point_id: 1 })),
    );
    useSettingsStore.setState({ point_id: 2 } as any);
    resolveSettings(
      settingsResponse({ point_id: 1, all_points: [{ id: 1 }, { id: 2 }], driver_avg_time: 0, driver_page_stat_time: 1 }),
    );
    await pending;

    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith('settings', { type: 'getMySetting', point_id: 2 }),
    );
    await waitFor(() => expect(useGlobalStore.getState().is_need_page_stat).toBe(false));
    expect(useGlobalStore.getState().is_need_avg_time).toBe(true);
  });
});
