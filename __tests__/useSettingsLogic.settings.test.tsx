import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: jest.fn() },
  AnalyticsEvent: {
    SystemSettingsOpen: 'SystemSettingsOpen',
  },
}));

const mockGetSettings = jest.fn();
const mockSaveSettings = jest.fn();
const mockLogogout = jest.fn();
const mockShowAlertText = jest.fn();
const mockShowModalText = jest.fn();
const mockClearPreview = jest.fn();
const mockResetRecommendation = jest.fn();
let mockDeviceScheme = 'light';
let mockOffline = false;

jest.mock('@/shared/theme/AppThemeProvider', () => ({
  useAppTheme: () => ({
    preference: 'system',
    deviceScheme: mockDeviceScheme,
    setPreviewPreference: jest.fn(),
    clearPreviewPreference: mockClearPreview,
  }),
}));

jest.mock('@/shared/ui/ConnectivityLocationIndicator', () => ({
  useIsOffline: () => mockOffline,
}));

jest.mock('@/features/order-recommendation/model/orderRecommendation.store', () => ({
  useOrderRecommendationStore: {getState: () => ({reset: mockResetRecommendation})},
}));

let mockSettingsState: any;
let mockCurrentUser: any;

jest.mock('@/shared/store/store', () => {
  const useSettingsStore: any = (selector: any) => selector(mockSettingsState);
  useSettingsStore.getState = () => mockSettingsState;

  return {
    useSettingsStore,
    useGlobalStore: (selector: any) => selector({
      globalFontSize: 18,
      showAlertText: mockShowAlertText,
      showModalText: mockShowModalText,
    }),
    useLoginStore: (selector: any) => selector({
      currentUser: mockCurrentUser,
      logogout: mockLogogout,
    }),
  };
});

import { useSettingsLogic } from '@/features/settings/model/useSettingsLogic';

describe('useSettingsLogic: локальное состояние и сохранение настроек', () => {
  let api: ReturnType<typeof useSettingsLogic> | null = null;

  function Probe() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    api = useSettingsLogic();
    return null as any;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    api = null;
    mockCurrentUser = { login: 'driver' };
    mockDeviceScheme = 'light';
    mockOffline = false;
    mockSaveSettings.mockResolvedValue(true);
    mockLogogout.mockResolvedValue(undefined);
    mockSettingsState = {
      getSettings: mockGetSettings,
      saveSettings: mockSaveSettings,
      isClick: false,
      action_centered_map: 1,
      color: '#cc0033',
      fontSize: '16px',
      mapScale: '1.25x',
      theme: 'white_border',
      type_data_map: 'norm',
      type_show_del: 'full',
      update_interval: 30,
      night_map: 0,
      is_scaleMap: 1,
      map_hints: 1,
      ai_recommend: 0,
    };
  });

  it('инициализирует локальный state из store и нормализует числовые значения', async () => {
    await render(<Probe />);

    expect(mockGetSettings).toHaveBeenCalledTimes(1);
    expect(api!.globalFontSize).toBe(18);
    expect(api!.typeShowDel).toBe('full');
    expect(api!.centeredMap).toBe(true);
    expect(api!.appThemePreference).toBe('system');
    expect(api!.showMapScale).toBe(true);
    expect(api!.showMapHints).toBe(true);
    expect(api!.aiRecommend).toBe(false);
    expect(api!.fontSize).toBe(16);
    expect(api!.mapScale).toBe(1.25);
    expect(api!.color).toBe('#cc0033');
    expect(api!.mapDataType).toBe('norm');
    expect(api!.markerTheme).toBe('white_border');
    expect(api!.isSaving).toBe(false);
  });

  it('saveSettingsFunc передает в store актуальные значения локальной формы', async () => {
    await render(<Probe />);

    await act(async () => {
      api!.setTypeShowDel('min');
      api!.setCenteredMap(false);
      api!.setFontSize(22);
      api!.setUpdateInterval(45);
      api!.setColor('#111111');
      api!.setMapScale(1.75);
      api!.setMapDataType('full');
      api!.setMarkerTheme('black');
      api!.setAppThemePreference('dark');
      api!.setShowMapScale(false);
      api!.setShowMapHints(false);
      api!.setAiRecommend(true);
    });

    await act(async () => {
      await api!.saveSettings();
    });

    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
    expect(mockSaveSettings).toHaveBeenCalledWith(
      'min',
      [],
      22,
      45,
      '#111111',
      1.75,
      'full',
      'black',
      ['is_night'],
      [],
      'dark',
      false,
      true,
    );
  });

  describe.each(['transparent', 'transparent_white'] as const)(
    'обычное сохранение темы меток %s',
    markerTheme => {
      it.each([
        {preference: 'light' as const, scheme: 'light', darkMap: false},
        {preference: 'light' as const, scheme: 'dark', darkMap: false},
        {preference: 'dark' as const, scheme: 'light', darkMap: true},
        {preference: 'dark' as const, scheme: 'dark', darkMap: true},
        {preference: 'system' as const, scheme: 'light', darkMap: false},
        {preference: 'system' as const, scheme: 'dark', darkMap: true},
      ])('сохраняет $preference при системной теме $scheme', async ({preference, scheme, darkMap}) => {
        mockDeviceScheme = scheme;
        await render(<Probe />);
        await act(async () => {
          api!.setMarkerTheme(markerTheme);
          api!.setAppThemePreference(preference);
        });

        await act(async () => {
          await api!.saveSettings();
        });

        expect(mockSaveSettings).toHaveBeenCalledTimes(1);
        const saved = mockSaveSettings.mock.calls[0];
        expect(saved[7]).toBe(darkMap ? 'transparent_white' : 'transparent');
        expect(saved[8]).toEqual(darkMap ? ['is_night'] : []);
        expect(saved[10]).toBe(preference);
        expect(api!.markerTheme).toBe(markerTheme);
      });
    },
  );

  describe.each(['white', 'black', 'white_border', 'classic'] as const)(
    'фиксированная тема меток %s',
    markerTheme => {
      it.each(['light', 'dark'])('не заменяется в системной теме %s', async scheme => {
        mockDeviceScheme = scheme;
        await render(<Probe />);
        await act(async () => {
          api!.setMarkerTheme(markerTheme);
          api!.setAppThemePreference('system');
        });
        await act(async () => {
          await api!.saveSettings();
        });

        expect(mockSaveSettings).toHaveBeenCalledTimes(1);
        const saved = mockSaveSettings.mock.calls[0];
        expect(saved[7]).toBe(markerTheme);
        expect(saved[8]).toEqual(scheme === 'dark' ? ['is_night'] : []);
        expect(saved[10]).toBe('system');
      });
    },
  );

  it('сохраняет прозрачные метки по новой системной теме без повторного выбора оформления', async () => {
    const screen = await render(<Probe />);
    await act(async () => {
      api!.setMarkerTheme('transparent');
      api!.setAppThemePreference('system');
    });
    await act(async () => {
      await api!.saveSettings();
    });

    mockDeviceScheme = 'dark';
    await screen.rerender(<Probe />);
    await act(async () => {
      await api!.saveSettings();
    });

    expect(mockSaveSettings).toHaveBeenCalledTimes(2);
    expect(mockSaveSettings.mock.calls[0].slice(7, 9)).toEqual(['transparent', []]);
    expect(mockSaveSettings.mock.calls[1].slice(7, 9)).toEqual([
      'transparent_white', ['is_night'],
    ]);
    expect(api!.markerTheme).toBe('transparent');
  });

  it('ограничивает размер шрифта перед показом и сохранением', async () => {
    mockSettingsState.fontSize = '40px';
    await render(<Probe />);

    expect(api!.fontSize).toBe(26);

    await act(async () => {
      api!.setFontSize(9);
    });
    expect(api!.fontSize).toBe(10);

    await act(async () => {
      api!.setFontSize(40);
    });
    expect(api!.fontSize).toBe(26);

    await act(async () => {
      await api!.saveSettings();
    });

    const lastSaveCall = mockSaveSettings.mock.calls[mockSaveSettings.mock.calls.length - 1];
    expect(lastSaveCall?.[2]).toBe(26);
  });

  it('разрешает фейковое удаление только demo-аккаунту и очищает обычную сессию', async () => {
    mockCurrentUser = { login: '79990000001' };
    await render(<Probe />);

    expect(api!.isDemoAccount).toBe(true);

    await act(async () => {
      await api!.deleteDemoAccount();
    });

    expect(mockLogogout).toHaveBeenCalledTimes(1);
    expect(mockShowAlertText).toHaveBeenCalledWith(true, 'Аккаунт удалён');
  });

  it('не запускает удаление для обычного пользователя', async () => {
    await render(<Probe />);

    expect(api!.isDemoAccount).toBe(false);

    let result = true;
    await act(async () => {
      result = await api!.deleteDemoAccount();
    });

    expect(result).toBe(false);
    expect(mockLogogout).not.toHaveBeenCalled();
    expect(mockShowAlertText).not.toHaveBeenCalled();
  });

  it.each(['light', 'dark'])('сбрасывает и сохраняет единые настройки по системной теме %s', async scheme => {
    mockDeviceScheme = scheme;
    await render(<Probe />);
    await act(async () => {
      api!.setFontSize(26);
      api!.setColor('#ffffff');
      api!.setMapDataType('full');
      api!.setMarkerTheme('black');
    });

    await act(async () => { expect(await api!.resetSettings()).toBe(true); });

    expect(mockSaveSettings).toHaveBeenCalledWith(
      'min', [], 16, 30, '#cc0033', 1, 'norm',
      scheme === 'dark' ? 'transparent_white' : 'transparent',
      scheme === 'dark' ? ['is_night'] : [], [], 'system', true, false,
      'Настройки сброшены',
    );
    expect(api!.fontSize).toBe(16);
    expect(api!.color).toBe('#cc0033');
    expect(api!.typeShowDel).toBe('min');
    expect(api!.mapDataType).toBe('norm');
    expect(api!.centeredMap).toBe(false);
    expect(api!.showMapHints).toBe(true);
    expect(api!.aiRecommend).toBe(false);
    expect(api!.appThemePreference).toBe('system');
    expect(mockClearPreview).toHaveBeenCalled();
    expect(mockResetRecommendation).toHaveBeenCalledTimes(1);
  });

  it('при ошибке сброса сохраняет несохранённый выбор формы', async () => {
    mockSaveSettings.mockResolvedValue(false);
    await render(<Probe />);
    await act(async () => {
      api!.setFontSize(26);
      api!.setColor('#ffffff');
      api!.setMarkerTheme('black');
      api!.setAppThemePreference('dark');
    });

    await act(async () => { expect(await api!.resetSettings()).toBe(false); });

    expect(api!.fontSize).toBe(26);
    expect(api!.color).toBe('#ffffff');
    expect(api!.markerTheme).toBe('black');
    expect(api!.appThemePreference).toBe('dark');
    expect(mockResetRecommendation).not.toHaveBeenCalled();
    expect(mockClearPreview).not.toHaveBeenCalled();
  });

  it('без сети не запускает сброс', async () => {
    mockOffline = true;
    await render(<Probe />);

    await act(async () => { expect(await api!.resetSettings()).toBe(false); });

    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it('не отправляет повторный сброс и обычное сохранение во время сброса', async () => {
    let finish!: (saved: boolean) => void;
    mockSaveSettings.mockReturnValueOnce(new Promise<boolean>(resolve => { finish = resolve; }));
    await render(<Probe />);
    let pending!: Promise<boolean>;
    await act(async () => {
      pending = api!.resetSettings();
      expect(await api!.resetSettings()).toBe(false);
      await api!.saveSettings();
    });
    expect(mockSaveSettings).toHaveBeenCalledTimes(1);

    await act(async () => { finish(true); await pending; });
  });
});
