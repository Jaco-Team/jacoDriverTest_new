const mockApi = jest.fn();
const mockAnalyticsLog = jest.fn();
const mockFetchLaravelFeedbacks = jest.fn();
const mockCreateLaravelFeedback = jest.fn();

jest.mock('@/shared/store/api', () => ({
  api: (...args: any[]) => mockApi(...args),
}));

jest.mock('@/shared/api/laravel/feedback', () => ({
  fetchLaravelFeedbacks: (...args: any[]) => mockFetchLaravelFeedbacks(...args),
  createLaravelFeedback: (...args: any[]) => mockCreateLaravelFeedback(...args),
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

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();

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
    } as any);
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('setStatus/setSearchQuery: обновляет фильтры списка', async () => {
    useFeedbackStore.getState().setStatus('В работе');
    useFeedbackStore.getState().setSearchQuery('ошибка');

    expect(useFeedbackStore.getState().chooseStatus).toBe('В работе');
    expect(useFeedbackStore.getState().searchQuery).toBe('ошибка');
  });

  it('fetchFeedbacks: загружает список обращений и гасит spinner по таймеру', async () => {
    mockFetchLaravelFeedbacks.mockResolvedValueOnce([feedback]);

    await useFeedbackStore.getState().fetchFeedbacks();

    expect(mockFetchLaravelFeedbacks).toHaveBeenCalledTimes(1);
    expect(useFeedbackStore.getState().feedbacks).toEqual([feedback]);
    expect(useGlobalStore.getState().loadSpinner).toBe(true);

    jest.advanceTimersByTime(300);

    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('fetchFeedbacks: при ошибке не затирает текущий список', async () => {
    useFeedbackStore.setState({ feedbacks: [feedback] });
    mockFetchLaravelFeedbacks.mockRejectedValueOnce(new Error('network'));

    await useFeedbackStore.getState().fetchFeedbacks();

    expect(useFeedbackStore.getState().feedbacks).toEqual([feedback]);
    expect(useGlobalStore.getState().loadSpinner).toBe(true);
  });

  it('fetchFeedbackById: открывает view modal с выбранным обращением', async () => {
    useFeedbackStore.setState({
      modal: {
        isCreateModalOpen: true,
        isViewModalOpen: false,
        selectedFeedback: null,
      },
    });
    useFeedbackStore.setState({ feedbacks: [feedback] });

    await useFeedbackStore.getState().fetchFeedbackById(1);

    expect(useFeedbackStore.getState().modal).toEqual({
      isCreateModalOpen: false,
      isViewModalOpen: true,
      selectedFeedback: feedback,
    });
  });

  it('modal helpers: открывает/закрывает create и view modal с аналитикой', async () => {
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
    const closeCreateModal = jest.fn();
    const fetchFeedbacks = jest.fn();
    useFeedbackStore.setState({
      closeCreateModal,
      fetchFeedbacks,
    } as any);
    mockCreateLaravelFeedback.mockResolvedValueOnce({ success: true, id: 42 });

    await useFeedbackStore.getState().createFeedback({
      title: 'Ошибка карты',
      description: 'Не обновляется адрес',
      type: 'ошибка',
      is_need_notification: 1,
      images: [{ uri: 'file://photo.jpg', fileName: 'photo.jpg', type: 'image/jpeg' }] as any,
    });

    expect(mockCreateLaravelFeedback).toHaveBeenCalledWith({
      title: 'Ошибка карты',
      description: 'Не обновляется адрес',
      type: 'ошибка',
      is_need_notification: 1,
      images: [
        { uri: 'file://photo.jpg', fileName: 'photo.jpg', type: 'image/jpeg' },
      ],
    });
    expect(mockAnalyticsLog).toHaveBeenCalledWith('FeedbackCreate', 'Создание предложения');
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
    mockCreateLaravelFeedback.mockRejectedValueOnce(new Error('Ошибка записи'));

    await useFeedbackStore.getState().createFeedback({
      title: 'Идея',
      description: 'Описание',
      type: 'предложение',
      is_need_notification: 0,
      images: [],
    });

    expect(useGlobalStore.getState().is_show_alert_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe(
      'Ошибка записи',
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

    expect(mockCreateLaravelFeedback).not.toHaveBeenCalled();
  });
});
