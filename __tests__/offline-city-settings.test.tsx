import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {OfflineCityMapsSettings} from '@/features/offline-map/ui/OfflineCityMapsSettings';
import {useOfflineMapStore} from '@/features/offline-map/model/offlineMap.store';
import {ConnectivityContext} from '@/shared/lib/connectivityContext';

jest.mock('@/components/ui/actionsheet', () => {
  const {View} = require('react-native');
  return {
    Actionsheet: ({children, isOpen}: any) =>
      isOpen ? <View>{children}</View> : null,
    ActionsheetBackdrop: View,
    ActionsheetContent: View,
    ActionsheetDragIndicator: View,
    ActionsheetDragIndicatorWrapper: View,
  };
});
const mockDownload = jest.fn();
const mockPause = jest.fn();
const mockRemove = jest.fn(async () => undefined);
beforeEach(() => {
  jest.clearAllMocks();
  useOfflineMapStore.setState({
    hydrated: true,
    selectedCityId: 'samara',
    cities: {},
    busyCityId: null,
    deletingCityId: null,
    error: '',
    download: mockDownload,
    pause: mockPause,
    remove: mockRemove,
  });
});

it('offers the same two cities and blocks download without internet', async () => {
  const screen = await render(
    <ConnectivityContext.Provider value={true}>
      <OfflineCityMapsSettings fontSize={16} />
    </ConnectivityContext.Provider>,
  );
  expect(screen.getByText('Офлайн-карты')).toBeTruthy();
  expect(screen.getByText('Самара')).toBeTruthy();
  expect(screen.getByText('Тольятти')).toBeTruthy();
  expect(screen.getByTestId('offline-city-download')).toBeDisabled();
  expect(screen.getByText('Для скачивания нужен интернет.')).toBeTruthy();
});
it('shows progress and pauses the selected city', async () => {
  useOfflineMapStore.setState({
    busyCityId: 'samara',
    cities: {
      samara: {
        regionId: 51,
        sizeBytes: 136191760,
        status: 'downloading',
        progress: 0.42,
        managed: true,
        autoResume: true,
      },
    },
  });
  const screen = await render(<OfflineCityMapsSettings fontSize={16} />);
  expect(screen.queryByText('Доступна офлайн')).toBeNull();
  expect(
    screen.getByTestId('offline-city-progress').props.accessibilityValue.now,
  ).toBe(42);
  await fireEvent.press(screen.getByTestId('offline-city-pause'));
  expect(mockPause).toHaveBeenCalledWith('samara');
});
it('completed map can be updated or deleted with explicit confirmation', async () => {
  useOfflineMapStore.setState({
    cities: {
      samara: {
        regionId: 51,
        status: 'ready',
        progress: 1,
        managed: true,
        autoResume: false,
      },
    },
  });
  const screen = await render(<OfflineCityMapsSettings fontSize={16} />);
  expect(screen.getByText('Доступна офлайн')).toBeTruthy();
  expect(screen.getByTestId('offline-city-delete')).toHaveStyle({
    width: 48,
    height: 48,
    borderWidth: 1,
    backgroundColor: 'transparent',
  });
  await fireEvent.press(screen.getByTestId('offline-city-download'));
  expect(mockDownload).toHaveBeenCalledWith('samara', true);
  await fireEvent.press(screen.getByTestId('offline-city-delete'));
  expect(mockRemove).not.toHaveBeenCalled();
  expect(screen.getByText('Удалить карту?')).toBeTruthy();
  expect(screen.getByTestId('offline-city-delete-sheet')).toHaveStyle({
    maxHeight: '75%',
    paddingHorizontal: 20,
    paddingTop: 9,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
  });
  expect(screen.getByTestId('offline-city-delete-message')).toHaveStyle({
    width: '100%',
    alignSelf: 'stretch',
    textAlign: 'left',
    marginBottom: 20,
  });
  expect(screen.getByTestId('offline-city-delete-message')).toHaveTextContent(
    'Карта «Самара» будет удалена с этого устройства. Её можно скачать снова.',
  );
  expect(screen.getByText('Нет')).toBeTruthy();
  expect(screen.getByTestId('offline-city-delete-cancel')).toHaveStyle({
    height: 44,
    minHeight: 44,
    flex: 1,
    borderRadius: 12,
  });
  expect(screen.getByTestId('offline-city-delete-confirm')).toHaveStyle({
    height: 44,
    minHeight: 44,
    flex: 1,
    borderRadius: 12,
  });
  await fireEvent.press(screen.getByTestId('offline-city-delete-cancel'));
  expect(mockRemove).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('offline-city-delete'));
  await fireEvent.press(screen.getByTestId('offline-city-delete-confirm'));
  expect(mockRemove).toHaveBeenCalledWith('samara');
});
it('manual pause exposes Continue and selecting another city preserves the download', async () => {
  useOfflineMapStore.setState({
    cities: {
      samara: {
        regionId: 51,
        status: 'paused',
        progress: 0.3,
        managed: true,
        autoResume: false,
      },
    },
  });
  const screen = await render(<OfflineCityMapsSettings fontSize={16} />);
  expect(screen.getByText('Продолжить')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('offline-city-download'));
  expect(mockDownload).toHaveBeenCalledWith('samara', false);
  await fireEvent.press(screen.getByTestId('offline-city-tolyatti'));
  expect(useOfflineMapStore.getState().cities.samara?.status).toBe('paused');
});
