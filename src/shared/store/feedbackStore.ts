import {create} from 'zustand';
import {isAxiosError} from 'axios';
import {getLaravelApiErrorInfo} from '@/shared/api/laravel/errors';
import {
  createLaravelFeedback,
  fetchLaravelFeedbacks,
} from '@/shared/api/laravel/feedback';
import {isAppOffline} from '@/shared/lib/connectivityState';
import {FeedbackStatus, FeedbackState} from './FeedbackStoreType';
import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';
import {useGlobalStore} from './globalStore';

let feedbackRequestId = 0;

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  is_click: false,
  feedbacks: [],
  isLoading: false,
  error: null,
  modal: {
    isCreateModalOpen: false,
    isViewModalOpen: false,
    selectedFeedback: null,
  },
  chooseStatus: '',
  searchQuery: '',

  setSearchQuery: (query: string) => set({searchQuery: query}),

  setStatus: (status: FeedbackStatus) => set({chooseStatus: status}),

  fetchFeedbacks: async () => {
    if (isAppOffline()) return true;

    const requestId = ++feedbackRequestId;
    if (get().feedbacks.length === 0) useGlobalStore.getState().setSpinner(true);
    set({isLoading: true, error: null});

    let settled = true;
    try {
      const feedbacks = await fetchLaravelFeedbacks();
      if (requestId === feedbackRequestId && !isAppOffline()) {
        set({feedbacks, error: null});
      }
    } catch (error) {
      if (requestId === feedbackRequestId && !isAppOffline()) {
        const info = getLaravelApiErrorInfo(error);
        settled = !((info.status !== null && info.status >= 500) || (info.status === null && isAxiosError(error)));
        set({error: info.message});
      }
    } finally {
      if (requestId === feedbackRequestId) set({isLoading: false});
    }

    useGlobalStore.getState().setSpinner(false);
    return settled;
  },

  fetchFeedbackById: async (id: number) => {
    const feedback = get().feedbacks.find(item => item.id === id) ?? null;
    set({
      modal: {
        ...get().modal,
        selectedFeedback: feedback,
        isCreateModalOpen: false,
        isViewModalOpen: feedback !== null,
      },
    });
  },

  // Создание предложения
  createFeedback: async feedback => {
    if (get().is_click == true) {
      return;
    } else {
      set({is_click: true});
    }

    useGlobalStore.getState().setSpinner(true);

    try {
      await createLaravelFeedback({
        title: feedback.title,
        description: feedback.description,
        type: feedback.type,
        is_need_notification: feedback.is_need_notification,
        images: feedback.images ?? [],
      });

      Analytics.log(AnalyticsEvent.FeedbackCreate, 'Создание предложения');
      useGlobalStore
        .getState()
        .showAlertText(true, 'Спасибо за обратную связь!');
      get().closeCreateModal();
      await get().fetchFeedbacks();
    } catch (error) {
      useGlobalStore
        .getState()
        .showAlertText(
          true,
          getLaravelApiErrorInfo(error).message ||
            'Произошла ошибка при записи, попробуйте ещё раз',
        );
    } finally {
      setTimeout(() => {
        useGlobalStore.getState().setSpinner(false);
        set({is_click: false});
      }, 300);
    }
  },

  // Открытие модалки создания обратной связи
  openCreateModal: () => {
    const m = get().modal;
    if (!m.isCreateModalOpen) {
      Analytics.log(
        AnalyticsEvent.FeedbackModalOpen,
        'Открытие модалки обратной связи',
      );
    }
    set({modal: {...m, isCreateModalOpen: true}});
  },

  // Закрытие модалки создания обратной связи
  closeCreateModal: () => {
    const m = get().modal;
    if (m.isCreateModalOpen) {
      Analytics.log(
        AnalyticsEvent.FeedbackModalClose,
        'Закрытие модалки обратной связи',
      );
    }
    set({modal: {...m, isCreateModalOpen: false}});
  },

  openViewModal: feedback => {
    set({
      modal: {
        isCreateModalOpen: false,
        isViewModalOpen: true,
        selectedFeedback: feedback,
      },
    });
  },
  closeViewModal: () =>
    set({
      modal: {
        ...get().modal,
        isViewModalOpen: false,
        selectedFeedback: null,
      },
    }),
}));
