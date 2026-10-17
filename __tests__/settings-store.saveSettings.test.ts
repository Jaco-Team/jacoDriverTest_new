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

import { useGlobalStore, useLoginStore, useSettingsStore } from '@/shared/store/store';
import {setAppOffline} from '@/shared/lib/connectivityState';
import { useAppThemeStore } from '@/shared/theme/AppThemeProvider';

describe('useSettingsStore.saveSettings', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    setAppOffline(false);
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
    useAppThemeStore.setState({preference: 'light', previewPreference: 'dark'});
  });

  afterEach(async () => {
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
      'dark',
      false,
      true,
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
      dark_theme: 1,
      app_theme: 'dark',
      is_scaleMap: 0,
      map_hints: 0,
      ai_recommend: 1,
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
    expect(useSettingsStore.getState()).toMatchObject({
      action_centered_map: 1,
      color: '#123456',
      fontSize: 20,
      mapScale: 1.5,
      theme: 'black',
      type_data_map: 'full',
      type_show_del: 'min',
      update_interval: 45,
      night_map: 1,
      is_scaleMap: 0,
      map_hints: 0,
      ai_recommend: 1,
    });
    expect(useSettingsStore.getState().isClick).toBe(true);
    expect(useGlobalStore.getState().loadSpinner).toBe(true);
    expect(useAppThemeStore.getState().preference).toBe('dark');
    expect(useAppThemeStore.getState().previewPreference).toBeNull();

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
    expect(useAppThemeStore.getState().preference).toBe('light');
    expect(useAppThemeStore.getState().previewPreference).toBe('dark');

    jest.advanceTimersByTime(300);

    expect(useSettingsStore.getState().isClick).toBe(false);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('ограничивает отправляемый и сохранённый размер шрифта значением 26', async () => {
    mockApi.mockResolvedValueOnce({st: true, text: ''});

    await useSettingsStore.getState().saveSettings(
      'full',
      [],
      40,
      30,
      '#000000',
      1,
      'norm',
      'white',
      [],
      [],
    );

    expect(mockApi).toHaveBeenCalledWith(
      'settings',
      expect.objectContaining({fontSize: 26}),
    );
    expect(useSettingsStore.getState().fontSize).toBe(26);
    expect(useGlobalStore.getState().globalFontSize).toBe(26);
  });

  it('ответ st=false считается ошибкой и не применяет настройки', async () => {
    mockApi.mockResolvedValueOnce({ st: false, text: 'Сохранение отклонено' });

    await useSettingsStore.getState().saveSettings(
      'full',
      [],
      24,
      60,
      '#654321',
      1.2,
      'norm',
      'classic',
      [],
      [],
    );

    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'SettingsSaveFail',
      'Ошибка в сохранение настроек',
    );
    expect(useGlobalStore.getState().is_show_modal_text).toBe(true);
    expect(useGlobalStore.getState().globalFontSize).toBe(16);

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

  it('возвращает результат сброса и показывает его сообщение только после сохранения', async () => {
    mockApi.mockResolvedValueOnce({st: true});
    const saved = await useSettingsStore.getState().saveSettings(
      'min', [], 16, 30, '#123456', 1, 'norm', 'transparent', [], [],
      'system', true, false, 'Настройки сброшены',
    );
    expect(saved).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe('Настройки сброшены');
    expect(useAppThemeStore.getState().preference).toBe('system');
  });

  it('не применяет сброс после смены токена/аккаунта', async () => {
    let finish!: (value: any) => void;
    mockApi.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const pending = useSettingsStore.getState().saveSettings(
      'min', [], 16, 30, '#123456', 1, 'norm', 'transparent', [], [], 'system', true, false,
    );
    await Promise.resolve();
    const previousUser = useLoginStore.getState().currentUser;
    useGlobalStore.setState({tokenAuth: 'new-token'});
    finish({st: true});
    expect(await pending).toBe(false);
    expect(useGlobalStore.getState().theme).toBe('white');
    expect(useAppThemeStore.getState().preference).toBe('light');
    expect(useLoginStore.getState().currentUser).toBe(previousUser);
  });

  it('без сети не отправляет сброс и возвращает false', async () => {
    setAppOffline(true);
    expect(await useSettingsStore.getState().saveSettings(
      'min', [], 16, 30, '#123456', 1, 'norm', 'transparent', [], [], 'system', true, false,
    )).toBe(false);
    expect(mockApi).not.toHaveBeenCalled();
    setAppOffline(false);
  });
});
