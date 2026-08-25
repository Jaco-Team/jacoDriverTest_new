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

let mockSettingsState: any;

jest.mock('@/shared/store/store', () => ({
  useSettingsStore: (selector: any) => selector(mockSettingsState),
  useGlobalStore: (selector: any) => selector({ globalFontSize: 18 }),
}));

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
    mockSettingsState = {
      getSettings: mockGetSettings,
      saveSettings: mockSaveSettings,
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
    };
  });

  it('инициализирует локальный state из store и сохраняет старое parseInt/parseFloat-поведение', async () => {
    await render(<Probe />);

    expect(mockGetSettings).toHaveBeenCalledTimes(1);
    expect(api!.globalFontSize).toBe(18);
    expect(api!.type_show_delState).toBe('full');
    expect(api!.centered_mapState).toEqual(['is_center']);
    expect(api!.night_mapState).toEqual([]);
    expect(api!.is_scaleMapState).toEqual(['is_scaleMap']);
    expect(api!.fontSizeState).toBe(16);
    expect(api!.mapScaleState).toBe(1.25);
    expect(api!.colorState).toBe('#cc0033');
    expect(api!.groupTypeTimeState).toBe('norm');
    expect(api!.groupTypeThemeState).toBe('white_border');
  });

  it('saveSettingsFunc передает в store актуальные значения локальной формы', async () => {
    await render(<Probe />);

    await act(async () => {
      api!.setType_show_del('min');
      api!.setCentered_map([]);
      api!.setFontSize(22);
      api!.setUpdate_interval(45);
      api!.setColor('#111111');
      api!.setMapScale(1.75);
      api!.setGroupTypeTime('full');
      api!.setGroupTypeTheme('black');
      api!.setNight_map(['is_night']);
      api!.setScale_map([]);
    });

    await act(async () => {
      api!.saveSettingsFunc();
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
    );
  });
});
