import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockSetNightMap = jest.fn();
const mockSetShowMapScale = jest.fn();
const mockSetCenteredMap = jest.fn();
const mockSetMapDataType = jest.fn();
const mockSetMarkerTheme = jest.fn();
const mockSaveSettings = jest.fn();
const mockSetPointId = jest.fn();
const mockDeleteDemoAccount = jest.fn();
const mockNavigationReset = jest.fn();
let mockPointId: number | null = 15;
let mockIsDemoAccount = true;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockNavigationReset }),
}));

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
jest.mock('@/components/ui/actionsheet', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Actionsheet: ({ children, isOpen }: any) => (
      isOpen ? <View>{children}</View> : null
    ),
    ActionsheetBackdrop: (props: any) => <View {...props} />,
    ActionsheetContent: ({ children, ...props }: any) => (
      <View {...props}>{children}</View>
    ),
    ActionsheetDragIndicator: ({ children, ...props }: any) => (
      <View {...props}>{children}</View>
    ),
    ActionsheetDragIndicatorWrapper: ({ children, ...props }: any) => (
      <View {...props}>{children}</View>
    ),
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
    points: [
      { id: 15, name: 'Самара, Металлургов 76А' },
      { id: 21, name: 'Тольятти, Мира 12' },
    ],
    pointId: mockPointId,
    setPointId: mockSetPointId,
    isDemoAccount: mockIsDemoAccount,
    deleteDemoAccount: mockDeleteDemoAccount,
  }),
}));

import { SettingsScreen } from '@/features/settings/ui/SettingsScreen';

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPointId = 15;
    mockIsDemoAccount = true;
    mockDeleteDemoAccount.mockResolvedValue(true);
  });

  it('показывает структуру и варианты актуальной страницы сайта', async () => {
    const screen = await render(<SettingsScreen />);

    expect(screen.getByText('Настройки приложения')).toBeTruthy();
    expect(screen.getByText('Кафе')).toBeTruthy();
    expect(screen.getByText('Самара, Металлургов 76А')).toBeTruthy();
    expect(screen.getByText('Формат данных на карте')).toBeTruthy();
    expect(screen.getByText('Отмененные заказы')).toBeTruthy();
    expect(screen.getByText('Карта')).toBeTruthy();
    expect(screen.getByText('Размер шрифта')).toBeTruthy();
    expect(screen.getByText('Масштабирование иконок на карте')).toBeTruthy();
    expect(screen.getByText('Частота обновления заказов')).toBeTruthy();
    expect(screen.getByText('Цвет на карте')).toBeTruthy();
    expect(screen.getByTestId('settings-marker-theme-transparent_white')).toBeTruthy();
  });

  it('открывает модальное окно кафе и выбирает точку Laravel API', async () => {
    const screen = await render(<SettingsScreen />);
    const select = screen.getByTestId('settings-cafe-select');
    const field = screen.getByTestId('settings-cafe-field');

    expect(StyleSheet.flatten(field.props.style)).toMatchObject({
      width: '100%',
      minHeight: 58,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    });

    expect(screen.queryByTestId('settings-cafe-sheet')).toBeNull();

    await fireEvent.press(select);

    const sheet = screen.getByTestId('settings-cafe-sheet');
    expect(StyleSheet.flatten(sheet.props.style)).toMatchObject({
      minHeight: '68%',
      maxHeight: '90%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    });
    expect(screen.queryByTestId('settings-cafe-dropdown')).toBeNull();
    const selectedOption = screen.getByTestId('settings-cafe-15');
    expect(selectedOption.props.accessibilityState).toEqual({
      selected: true,
    });
    expect(StyleSheet.flatten(selectedOption.props.style)).toMatchObject({
      minHeight: 62,
      borderBottomWidth: 1,
      backgroundColor: '#f3f6f8',
    });
    expect(screen.getByText('Тольятти, Мира 12')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('settings-cafe-21'));

    expect(mockSetPointId).toHaveBeenCalledWith(21);
    expect(screen.queryByTestId('settings-cafe-sheet')).toBeNull();

    await fireEvent.press(screen.getByTestId('settings-cafe-clear'));
    expect(mockSetPointId).toHaveBeenLastCalledWith(null);
  });

  it('оформляет пустое значение кафе как placeholder сайта', async () => {
    mockPointId = null;
    const screen = await render(<SettingsScreen />);
    const placeholder = screen.getByText('Выберите кафе');

    expect(StyleSheet.flatten(placeholder.props.style)).toMatchObject({
      color: '#6f7f8d',
      fontSize: 15,
      fontWeight: '600',
    });
    expect(screen.queryByTestId('settings-cafe-clear')).toBeNull();
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

  it('показывает удаление только demo-аккаунту и закрывает подтверждение без удаления', async () => {
    const screen = await render(<SettingsScreen />);

    expect(screen.getByTestId('settings-delete-account-zone')).toBeTruthy();
    expect(screen.queryByTestId('settings-delete-account-sheet')).toBeNull();

    await fireEvent.press(screen.getByTestId('settings-delete-account'));
    expect(screen.getByTestId('settings-delete-account-sheet')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('settings-delete-account-cancel'));
    expect(screen.queryByTestId('settings-delete-account-sheet')).toBeNull();
    expect(mockDeleteDemoAccount).not.toHaveBeenCalled();

  });

  it('не показывает удаление обычному аккаунту', async () => {
    mockIsDemoAccount = false;
    const screen = await render(<SettingsScreen />);

    expect(screen.queryByTestId('settings-delete-account-zone')).toBeNull();
  });

  it('показывает loading, очищает demo-сессию и возвращает на авторизацию', async () => {
    let finishDeletion: ((deleted: boolean) => void) | undefined;
    mockDeleteDemoAccount.mockReturnValueOnce(
      new Promise<boolean>(resolve => {
        finishDeletion = resolve;
      }),
    );
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-delete-account'));
    await fireEvent.press(screen.getByTestId('settings-delete-account-confirm'));

    expect(screen.getByTestId('settings-delete-account-loading')).toBeTruthy();
    expect(mockDeleteDemoAccount).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishDeletion?.(true);
    });

    await waitFor(() => {
      expect(mockNavigationReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    });
    expect(screen.queryByTestId('settings-delete-account-sheet')).toBeNull();
  });
});
