export type FeedbackType = 'предложение' | 'ошибка' | 'улучшение' | 'другое';

export type FeedbackStatus = 'Новое' | 'В работе' | 'Отклонено' | 'Решено' | '';

export interface FeedbackResponse {
  id: number;
  title: string;
  description: string;
  user: string;
  date_time_create: Date;
  status: FeedbackStatus;
  answer: string;
  type: FeedbackType;
  images?: ImageAsset[];
}

export interface Feedback extends FeedbackResponse {
  
}

interface FeedbackCreate {
  type: FeedbackType;
  title: string;
  description: string;
  is_need_notification: 1|0;
  images: Asset[];
}

export interface ModalState {
  isCreateModalOpen: boolean;
  isViewModalOpen: boolean;
  selectedFeedback: FeedbackResponse | null;
}

export interface UploadImagesResult {
  success: boolean;
  message: string;
}

// interface ImageAsset {
//   uri?: string;
//   fileName?: string;
//   type?: string;
// }

interface ImageAsset {
  uri?: string;
}

import { Asset } from 'react-native-image-picker';

export interface FeedbackState {
  is_click: boolean;
  feedbacks: Array<FeedbackResponse>|[];
  isLoading: boolean;
  error: string | null;
  modal: ModalState;
  
  chooseStatus: FeedbackStatus;
  setStatus: (status: FeedbackStatus) => void;

  searchQuery: string,
  setSearchQuery: (query: string) => void,

  // Методы для управления состоянием списка
  fetchFeedbacks: () => Promise<void>;
  fetchFeedbackById: (id: number) => Promise<void>;
  createFeedback: (feedback: FeedbackCreate) => Promise<void>;
  
  // Методы для управления модальными окнами
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openViewModal: (feedback: Feedback) => void;
  closeViewModal: () => void;
  uploadImages: (id: string | number, images: Asset[]) => Promise<UploadImagesResult>;
}

export interface fetchFeedbacksResponse {
  feedbacks: Array<FeedbackResponse>
}

export interface fetchFeedbackResponse {
  feedback: FeedbackResponse
}

export interface createFeedbackResponse {
  st: boolean,
  id: number
}