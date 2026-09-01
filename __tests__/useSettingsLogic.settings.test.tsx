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
    };
  });

  it('инициализирует локальный state из store и нормализует числовые значения', async () => {
    await render(<Probe />);

    expect(mockGetSettings).toHaveBeenCalledTimes(1);
    expect(api!.globalFontSize).toBe(18);
    expect(api!.typeShowDel).toBe('full');
    expect(api!.centeredMap).toBe(true);
    expect(api!.nightMap).toBe(false);
    expect(api!.showMapScale).toBe(true);
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
      api!.setNightMap(true);
      api!.setShowMapScale(false);
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
    );
  });
});
