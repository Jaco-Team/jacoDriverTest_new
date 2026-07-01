const mockApi = jest.fn();
const mockAnalyticsLog = jest.fn();

jest.mock('@/shared/store/api', () => ({
  api: (...args: any[]) => mockApi(...args),
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: (...args: any[]) => mockAnalyticsLog(...args) },
  AnalyticsEvent: {
    SettingsSaveSuccess: 'SettingsSaveSuccess',
    SettingsSaveFail: 'SettingsSaveFail',
  },
}));

import { useGlobalStore, useSettingsStore } from '@/shared/store/store';

describe('useSettingsStore.saveSettings', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useGlobalStore.setState({
      tokenAuth: 'test-token',
      loadSpinner: false,
      globalFontSize: 16,
      theme: 'white',
      mapScale: 1,
      is_show_alert_text: false,
      is_show_modal_text: false,
      modal_text: '',
    });
    useSettingsStore.setState({
      isClick: false,
    } as any);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('success: отправляет настройки, обновляет global store и сбрасывает isClick/spinner по таймеру', async () => {
    mockApi.mockResolvedValueOnce({ st: true, text: '' });

    await useSettingsStore.getState().saveSettings(
      'min',
      ['is_center'],
      20,
      45,
      '#123456',
      1.5,
      'full',
      'black',
      ['is_night'],
      [],
    );

    expect(mockApi).toHaveBeenCalledWith('settings', {
      type: 'saveMySetting',
      token: 'test-token',
      color: '#123456',
      type_show_del: 'min',
      update_interval: 45,
      type_data_map: 'full',
      action_centered_map: 1,
      night_map: 1,
      is_scaleMap: 0,
      fontSize: 20,
      theme: 'black',
      mapScale: 1.5,
    });
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'SettingsSaveSuccess',
      'Успешное сохранение настроек',
    );
    expect(useGlobalStore.getState().globalFontSize).toBe(20);
    expect(useGlobalStore.getState().theme).toBe('black');
    expect(useGlobalStore.getState().mapScale).toBe(1.5);
    expect(useGlobalStore.getState().is_show_alert_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe('Настройки сохранены');
    expect(useSettingsStore.getState().isClick).toBe(true);
    expect(useGlobalStore.getState().loadSpinner).toBe(true);

    jest.advanceTimersByTime(300);

    expect(useSettingsStore.getState().isClick).toBe(false);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('error: показывает modal error и не применяет новые global настройки', async () => {
    mockApi.mockRejectedValueOnce(new Error('network'));

    await useSettingsStore.getState().saveSettings(
      'full',
      [],
      24,
      60,
      '#654321',
      2,
      'norm',
      'classic',
      [],
      ['is_scaleMap'],
    );

    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'SettingsSaveFail',
      'Ошибка в сохранение настроек',
    );
    expect(useGlobalStore.getState().is_show_modal_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe('Не удалось сохранить настройки');
    expect(useGlobalStore.getState().globalFontSize).toBe(16);
    expect(useGlobalStore.getState().theme).toBe('white');
    expect(useGlobalStore.getState().mapScale).toBe(1);

    jest.advanceTimersByTime(300);

    expect(useSettingsStore.getState().isClick).toBe(false);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('double click guard: пока isClick=true, повторное сохранение не отправляет API', async () => {
    useSettingsStore.setState({ isClick: true } as any);

    await useSettingsStore.getState().saveSettings(
      'full',
      [],
      18,
      30,
      '#000000',
      1,
      'norm',
      'white',
      [],
      [],
    );

    expect(mockApi).not.toHaveBeenCalled();
  });
});
