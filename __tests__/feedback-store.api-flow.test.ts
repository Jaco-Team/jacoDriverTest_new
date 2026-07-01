const mockApi = jest.fn();
const mockAnalyticsLog = jest.fn();

jest.mock('@/shared/store/api', () => ({
  api: (...args: any[]) => mockApi(...args),
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: (...args: any[]) => mockAnalyticsLog(...args) },
  AnalyticsEvent: {
    FeedbackCreate: 'FeedbackCreate',
    FeedbackModalOpen: 'FeedbackModalOpen',
    FeedbackModalClose: 'FeedbackModalClose',
  },
}));

import { useFeedbackStore, useGlobalStore } from '@/shared/store/store';
import { FeedbackResponse } from '@/shared/store/FeedbackStoreType';

const originalFetchFeedbacks = useFeedbackStore.getState().fetchFeedbacks;
const originalCloseCreateModal = useFeedbackStore.getState().closeCreateModal;
const originalUploadImages = useFeedbackStore.getState().uploadImages;
const originalFetch = global.fetch;

describe('useFeedbackStore api flow', () => {
  const feedback: FeedbackResponse = {
    id: 1,
    title: 'Идея',
    description: 'Добавить фильтр',
    user: 'Driver',
    date_time_create: new Date('2026-06-30T10:00:00Z'),
    status: 'Новое',
    answer: '',
    type: 'предложение',
    images: [],
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    global.fetch = originalFetch;

    useGlobalStore.setState({
      tokenAuth: 'feedback-token',
      notifToken: 'push-token',
      loadSpinner: false,
      is_show_alert_text: false,
      is_show_modal_text: false,
      modal_text: '',
    });
    useFeedbackStore.setState({
      is_click: false,
      feedbacks: [],
      modal: {
        isCreateModalOpen: false,
        isViewModalOpen: false,
        selectedFeedback: null,
      },
      chooseStatus: '',
      searchQuery: '',
      fetchFeedbacks: originalFetchFeedbacks,
      closeCreateModal: originalCloseCreateModal,
      uploadImages: originalUploadImages,
    } as any);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it('setStatus/setSearchQuery: обновляет фильтры списка', () => {
    useFeedbackStore.getState().setStatus('В работе');
    useFeedbackStore.getState().setSearchQuery('ошибка');

    expect(useFeedbackStore.getState().chooseStatus).toBe('В работе');
    expect(useFeedbackStore.getState().searchQuery).toBe('ошибка');
  });

  it('fetchFeedbacks: загружает список обращений и гасит spinner по таймеру', async () => {
    mockApi.mockResolvedValueOnce({
      st: true,
      data: {
        feedbacks: [feedback],
      },
    });

    await useFeedbackStore.getState().fetchFeedbacks();

    expect(mockApi).toHaveBeenCalledWith('feedback', {
      type: 'get_feedbacks',
      token: 'feedback-token',
    });
    expect(useFeedbackStore.getState().feedbacks).toEqual([feedback]);
    expect(useGlobalStore.getState().loadSpinner).toBe(true);

    jest.advanceTimersByTime(300);

    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('fetchFeedbacks: при st=false не затирает текущий список и сразу гасит spinner', async () => {
    useFeedbackStore.setState({ feedbacks: [feedback] });
    mockApi.mockResolvedValueOnce({ st: false });

    await useFeedbackStore.getState().fetchFeedbacks();

    expect(useFeedbackStore.getState().feedbacks).toEqual([feedback]);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('fetchFeedbackById: открывает view modal с выбранным обращением', async () => {
    useFeedbackStore.setState({
      modal: {
        isCreateModalOpen: true,
        isViewModalOpen: false,
        selectedFeedback: null,
      },
    });
    mockApi.mockResolvedValueOnce({
      st: true,
      data: {
        feedback,
      },
    });

    await useFeedbackStore.getState().fetchFeedbackById(1);

    expect(mockApi).toHaveBeenCalledWith('feedback', {
      type: 'get_feedback_id',
      id: 1,
      token: 'feedback-token',
    });
    expect(useFeedbackStore.getState().modal).toEqual({
      isCreateModalOpen: false,
      isViewModalOpen: true,
      selectedFeedback: feedback,
    });
  });

  it('modal helpers: открывает/закрывает create и view modal с аналитикой', () => {
    useFeedbackStore.getState().openCreateModal();

    expect(useFeedbackStore.getState().modal.isCreateModalOpen).toBe(true);
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'FeedbackModalOpen',
      'Открытие модалки обратной связи',
    );

    useFeedbackStore.getState().closeCreateModal();

    expect(useFeedbackStore.getState().modal.isCreateModalOpen).toBe(false);
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'FeedbackModalClose',
      'Закрытие модалки обратной связи',
    );

    useFeedbackStore.getState().openViewModal(feedback);

    expect(useFeedbackStore.getState().modal).toEqual({
      isCreateModalOpen: false,
      isViewModalOpen: true,
      selectedFeedback: feedback,
    });

    useFeedbackStore.getState().closeViewModal();

    expect(useFeedbackStore.getState().modal.isViewModalOpen).toBe(false);
    expect(useFeedbackStore.getState().modal.selectedFeedback).toBeNull();
  });

  it('createFeedback: success отправляет payload, закрывает форму и обновляет список', async () => {
    const uploadImages = jest.fn().mockResolvedValue({
      success: true,
      message: 'uploaded',
    });
    const closeCreateModal = jest.fn();
    const fetchFeedbacks = jest.fn();
    useFeedbackStore.setState({
      uploadImages,
      closeCreateModal,
      fetchFeedbacks,
    } as any);
    mockApi.mockResolvedValueOnce({
      data: {
        st: true,
        id: 42,
      },
    });

    await useFeedbackStore.getState().createFeedback({
      title: 'Ошибка карты',
      description: 'Не обновляется адрес',
      type: 'ошибка',
      is_need_notification: 1,
      images: [{ uri: 'file://photo.jpg', fileName: 'photo.jpg', type: 'image/jpeg' }] as any,
    });

    expect(mockApi).toHaveBeenCalledWith('feedback', {
      type: 'create_feedback',
      token: 'feedback-token',
      feedback_title: 'Ошибка карты',
      feedback_description: 'Не обновляется адрес',
      feedback_type: 'ошибка',
      feedback_is_need_notification: 1,
      notifToken: 'push-token',
    });
    expect(mockAnalyticsLog).toHaveBeenCalledWith('FeedbackCreate', 'Создание предложения');
    expect(uploadImages).toHaveBeenCalledWith(42, [
      { uri: 'file://photo.jpg', fileName: 'photo.jpg', type: 'image/jpeg' },
    ]);
    expect(useGlobalStore.getState().is_show_alert_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe('Спасибо за обратную связь!');
    expect(closeCreateModal).toHaveBeenCalledTimes(1);
    expect(fetchFeedbacks).toHaveBeenCalledTimes(1);
    expect(useFeedbackStore.getState().is_click).toBe(true);
    expect(useGlobalStore.getState().loadSpinner).toBe(true);

    jest.advanceTimersByTime(300);

    expect(useFeedbackStore.getState().is_click).toBe(false);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('createFeedback: API error показывает alert и сбрасывает click/spinner по таймеру', async () => {
    mockApi.mockResolvedValueOnce({
      data: {
        st: false,
      },
    });

    await useFeedbackStore.getState().createFeedback({
      title: 'Идея',
      description: 'Описание',
      type: 'предложение',
      is_need_notification: 0,
      images: [],
    });

    expect(useGlobalStore.getState().is_show_alert_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe(
      'Произошла ошибка при записи, попробуй еще раз',
    );
    expect(useFeedbackStore.getState().is_click).toBe(true);

    jest.advanceTimersByTime(300);

    expect(useFeedbackStore.getState().is_click).toBe(false);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('createFeedback: double click guard не отправляет повторный запрос', async () => {
    useFeedbackStore.setState({ is_click: true });

    await useFeedbackStore.getState().createFeedback({
      title: 'Идея',
      description: 'Описание',
      type: 'предложение',
      is_need_notification: 0,
      images: [],
    });

    expect(mockApi).not.toHaveBeenCalled();
  });

  it('uploadImages: без изображений сразу возвращает success', async () => {
    const result = await useFeedbackStore.getState().uploadImages(42, []);

    expect(result).toEqual({
      success: true,
      message: 'No images to upload',
    });
  });

  it('uploadImages: отправляет изображения через fetch и возвращает server response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        message: 'ok',
      }),
    });
    global.fetch = fetchMock as any;

    const result = await useFeedbackStore.getState().uploadImages(42, [
      { uri: 'file://photo.png', fileName: 'photo.png', type: 'image/png' },
      { uri: undefined, fileName: 'skip.jpg', type: 'image/jpeg' },
    ] as any);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.jacochef.ru/driver/image/upload-images.php',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
    expect(result).toEqual({
      success: true,
      message: 'ok',
    });
  });
});
