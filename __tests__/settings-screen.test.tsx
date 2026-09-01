import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockSetNightMap = jest.fn();
const mockSetShowMapScale = jest.fn();
const mockSetCenteredMap = jest.fn();
const mockSetMapDataType = jest.fn();
const mockSetMarkerTheme = jest.fn();
const mockSaveSettings = jest.fn();

jest.mock('react-native-wheel-color-picker', () => {
  const { View } = require('react-native');
  return () => <View testID="mock-color-picker" />;
});
jest.mock('@/shared/ui/ScreenLayout', () => {
  const { View } = require('react-native');
  return { ScreenLayout: ({ children }: any) => <View>{children}</View> };
});
jest.mock('@/components/ui/slider', () => {
  const { View } = require('react-native');
  return {
    Slider: ({ children, testID }: any) => <View testID={testID}>{children}</View>,
    SliderTrack: ({ children }: any) => <View>{children}</View>,
    SliderFilledTrack: () => <View />,
    SliderThumb: () => <View />,
  };
});
jest.mock('@/features/settings/ui/MapPointTime', () => {
  const { Pressable, Text } = require('react-native');
  return {
    MapPointTime: ({ value, text, setActive }: any) => (
      <Pressable testID={`settings-map-data-${value}`} onPress={() => setActive(value)}>
        <Text>{text}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/features/settings/ui/MapPointTheme', () => {
  const { Pressable, Text } = require('react-native');
  return {
    MapPointTheme: ({ value, text, setActive }: any) => (
      <Pressable testID={`settings-marker-theme-${value}`} onPress={() => setActive(value)}>
        <Text>{text}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/features/settings/model/useSettingsLogic', () => ({
  useSettingsLogic: () => ({
    globalFontSize: 16,
    typeShowDel: 'full',
    setTypeShowDel: jest.fn(),
    centeredMap: true,
    setCenteredMap: mockSetCenteredMap,
    fontSize: 16,
    setFontSize: jest.fn(),
    updateInterval: 30,
    setUpdateInterval: jest.fn(),
    color: '#cc0033',
    setColor: jest.fn(),
    isColorPickerActive: false,
    setIsColorPickerActive: jest.fn(),
    mapDataType: 'norm',
    setMapDataType: mockSetMapDataType,
    markerTheme: 'white_border',
    setMarkerTheme: mockSetMarkerTheme,
    mapScale: 1,
    setMapScale: jest.fn(),
    nightMap: false,
    setNightMap: mockSetNightMap,
    showMapScale: true,
    setShowMapScale: mockSetShowMapScale,
    isSaving: false,
    saveSettings: mockSaveSettings,
  }),
}));

import { SettingsScreen } from '@/features/settings/ui/SettingsScreen';

describe('SettingsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('показывает структуру и варианты актуальной страницы сайта', async () => {
    const screen = await render(<SettingsScreen />);

    expect(screen.getByText('Настройки приложения')).toBeTruthy();
    expect(screen.getByText('Формат данных на карте')).toBeTruthy();
    expect(screen.getByText('Отмененные заказы')).toBeTruthy();
    expect(screen.getByText('Карта')).toBeTruthy();
    expect(screen.getByText('Размер шрифта')).toBeTruthy();
    expect(screen.getByText('Масштабирование иконок на карте')).toBeTruthy();
    expect(screen.getByText('Частота обновления заказов')).toBeTruthy();
    expect(screen.getByText('Цвет на карте')).toBeTruthy();
    expect(screen.getByTestId('settings-marker-theme-transparent_white')).toBeTruthy();
  });

  it('переключает каждый параметр карты независимо и сохраняет форму', async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-night-map'));
    await fireEvent.press(screen.getByTestId('settings-map-scale-control'));
    await fireEvent.press(screen.getByTestId('settings-center-map'));
    await fireEvent.press(screen.getByTestId('settings-map-data-full'));
    await fireEvent.press(screen.getByTestId('settings-marker-theme-transparent_white'));
    await fireEvent.press(screen.getByTestId('settings-save'));

    expect(mockSetNightMap).toHaveBeenCalledWith(true);
    expect(mockSetShowMapScale).toHaveBeenCalledWith(false);
    expect(mockSetCenteredMap).toHaveBeenCalledWith(false);
    expect(mockSetMapDataType).toHaveBeenCalledWith('full');
    expect(mockSetMarkerTheme).toHaveBeenCalledWith('transparent_white');
    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
  });
});
