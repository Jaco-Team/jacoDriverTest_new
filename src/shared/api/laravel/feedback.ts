import type { Asset } from 'react-native-image-picker'

import type {
  FeedbackResponse,
  FeedbackStatus,
  FeedbackType,
} from '@/shared/store/FeedbackStoreType'
import { getLaravelAuthToken } from '@/shared/lib/laravelAuthTokenStorage'

import { bearerHeaders, laravelHttp } from './connector'
import { laravelApiRoutes } from './routes'

type LaravelFeedback = Omit<FeedbackResponse, 'status' | 'date_time_create' | 'user'> & {
  date_time_create: string | null
  status: number | string
  user?: string
}

type LaravelFeedbackListResponse = {
  data?: LaravelFeedback[]
}

type LaravelSaveFeedbackResponse = {
  data?: LaravelFeedback
  id?: number
  message?: string
  success?: boolean
}

const feedbackStatuses: Record<string, FeedbackStatus> = {
  '1': 'Новое',
  '2': 'В работе',
  '3': 'Отклонено',
  '4': 'Решено',
}

function requireToken(token: string | null): string {
  if (!token) throw new Error('Сессия истекла. Войдите снова.')
  return token
}

function normalizeFeedback(feedback: LaravelFeedback): FeedbackResponse {
  const rawStatus = String(feedback.status ?? '').trim()

  return {
    ...feedback,
    user: feedback.user ?? '',
    status: feedbackStatuses[rawStatus] ?? (rawStatus as FeedbackStatus),
    date_time_create: feedback.date_time_create ?? '',
  }
}

export async function fetchLaravelFeedbacks(): Promise<FeedbackResponse[]> {
  const token = requireToken(await getLaravelAuthToken())
  const { data } = await laravelHttp.get<LaravelFeedbackListResponse>(
    laravelApiRoutes.feedback.getFeedbacks,
    { headers: bearerHeaders(token) },
  )

  return Array.isArray(data?.data) ? data.data.map(normalizeFeedback) : []
}

export async function createLaravelFeedback(input: {
  title: string
  description: string
  type: FeedbackType
  is_need_notification: 0 | 1
  images: Asset[]
}): Promise<LaravelSaveFeedbackResponse> {
  const token = requireToken(await getLaravelAuthToken())
  const formData = new FormData()

  formData.append('title', input.title)
  formData.append('description', input.description)
  formData.append('type', input.type)
  formData.append('is_need_notification', String(input.is_need_notification))

  input.images.forEach((image, index) => {
    if (!image.uri) return

    formData.append('images[]', {
      uri: image.uri,
      type: image.type ?? 'image/jpeg',
      name: image.fileName ?? `feedback-${index + 1}.jpg`,
    } as any)
  })

  const { data } = await laravelHttp.post<LaravelSaveFeedbackResponse>(
    laravelApiRoutes.feedback.saveFeedbacks,
    formData,
    {
      headers: {
        ...bearerHeaders(token),
        'Content-Type': 'multipart/form-data',
      },
    },
  )

  return data
}
