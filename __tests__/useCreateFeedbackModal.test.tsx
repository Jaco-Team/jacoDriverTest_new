import React from 'react';
import { Alert } from 'react-native';
import { render, act } from '@testing-library/react-native';

jest.mock('react-native', () => ({
  ...jest.requireActual('../__mocks__/react-native.js'),
  Alert: { alert: jest.fn() },
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockLaunchImageLibrary = jest.fn();
const mockLaunchCamera = jest.fn();

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: (...args: any[]) => mockLaunchImageLibrary(...args),
  launchCamera: (...args: any[]) => mockLaunchCamera(...args),
}));

const mockCloseCreateModal = jest.fn();
const mockCreateFeedback = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockShowModalText = jest.fn();

let mockFeedbackState: any;
let mockGlobalState: any;

jest.mock('@/shared/store/store', () => ({
  useFeedbackStore: (selector: any) => selector(mockFeedbackState),
  useGlobalStore: (selector: any) => selector(mockGlobalState),
}));

import { useCreateFeedbackModal } from '@/features/feedback/model/useCreateFeedbackModal';

describe('useCreateFeedbackModal: форма и image picker', () => {
  let api: ReturnType<typeof useCreateFeedbackModal> | null = null;
  let consoleLogSpy: jest.SpyInstance;

  function Probe() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    api = useCreateFeedbackModal();
    return null as any;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(jest.fn());
    api = null;
    mockFeedbackState = {
      modal: { isCreateModalOpen: true },
      closeCreateModal: mockCloseCreateModal,
      createFeedback: mockCreateFeedback,
      searchQuery: '',
      setSearchQuery: mockSetSearchQuery,
    };
    mockGlobalState = {
      globalFontSize: 16,
      showModalText: mockShowModalText,
    };
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
  });

  it('не отправляет пустую форму и показывает ошибку заголовка', async () => {
    await render(<Probe />);

    await act(async () => {
      api!.handleSubmit();
    });

    expect(mockShowModalText).toHaveBeenCalledWith(true, 'Пожалуйста, введите заголовок');
    expect(mockCreateFeedback).not.toHaveBeenCalled();
  });

  it('не отправляет форму без описания', async () => {
    await render(<Probe />);

    await act(async () => {
      api!.setTitle('Идея');
    });
    await act(async () => {
      api!.handleSubmit();
    });

    expect(mockShowModalText).toHaveBeenCalledWith(true, 'Пожалуйста, введите описание');
    expect(mockCreateFeedback).not.toHaveBeenCalled();
  });

  it('отправляет createFeedback с текущими полями, уведомлением и изображениями', async () => {
    const image = { uri: 'file://photo.jpg', fileName: 'photo.jpg', type: 'image/jpeg' };
    await render(<Probe />);

    await act(async () => {
      api!.setTitle('Ошибка');
      api!.setDescription('Описание проблемы');
      api!.setType('ошибка');
      api!.setIs_need_notification(['is_need_notification']);
      api!.handleImagePickerResponse({ assets: [image] } as any);
    });
    await act(async () => {
      api!.handleSubmit();
    });

    expect(mockCreateFeedback).toHaveBeenCalledTimes(1);
    expect(mockCreateFeedback).toHaveBeenCalledWith({
      title: 'Ошибка',
      description: 'Описание проблемы',
      type: 'ошибка',
      is_need_notification: 1,
      images: [image],
    });
  });

  it('вызывает gallery picker с ожидаемыми photo options', async () => {
    await render(<Probe />);

    await act(async () => {
      api!.pickImageFromGallery();
    });

    expect(mockLaunchImageLibrary).toHaveBeenCalledTimes(1);
    expect(mockLaunchImageLibrary.mock.calls[0][0]).toEqual({
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
      selectionLimit: 0,
    });
    expect(typeof mockLaunchImageLibrary.mock.calls[0][1]).toBe('function');
  });

  it('вызывает camera picker с ожидаемыми photo options', async () => {
    await render(<Probe />);

    await act(async () => {
      api!.takePhoto();
    });

    expect(mockLaunchCamera).toHaveBeenCalledTimes(1);
    expect(mockLaunchCamera.mock.calls[0][0]).toEqual({
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
      saveToPhotos: true,
    });
    expect(typeof mockLaunchCamera.mock.calls[0][1]).toBe('function');
  });

  it('показывает Alert при ошибке image picker и не добавляет изображение', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    await render(<Probe />);

    await act(async () => {
      api!.handleImagePickerResponse({
        errorCode: 'camera_unavailable',
        errorMessage: 'Камера недоступна',
      } as any);
    });

    expect(alertSpy).toHaveBeenCalledWith('Ошибка', 'Камера недоступна');
    expect(api!.images).toEqual([]);
  });
});
