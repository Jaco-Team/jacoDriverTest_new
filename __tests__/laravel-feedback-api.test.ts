const mockGet = jest.fn()
const mockPost = jest.fn()
const mockGetLaravelAuthToken = jest.fn()

jest.mock('@/shared/api/laravel/connector', () => ({
  bearerHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
  laravelHttp: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

jest.mock('@/shared/lib/laravelAuthTokenStorage', () => ({
  getLaravelAuthToken: (...args: unknown[]) => mockGetLaravelAuthToken(...args),
}))

import {
  createLaravelFeedback,
  fetchLaravelFeedbacks,
} from '@/shared/api/laravel/feedback'

describe('Laravel feedback API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetLaravelAuthToken.mockResolvedValue('secure-token')
  })

  it('loads feedback and maps numeric statuses to mobile labels', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 1,
            title: 'Идея',
            description: 'Описание',
            type: 'предложение',
            status: 4,
            answer: 'Готово',
            date_time_create: '2026-09-03 12:00:00',
          },
        ],
      },
    })

    const feedback = await fetchLaravelFeedbacks()

    expect(mockGet).toHaveBeenCalledWith('/api/v1/feedback/get_feedbacks', {
      headers: { Authorization: 'Bearer secure-token' },
    })
    expect(feedback[0]).toEqual(expect.objectContaining({ status: 'Решено', user: '' }))
  })

  it('sends text and images together to Laravel multipart endpoint', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true, id: 7 } })

    await createLaravelFeedback({
      title: 'Ошибка карты',
      description: 'Описание',
      type: 'ошибка',
      is_need_notification: 1,
      images: [{ uri: 'file://photo.jpg', type: 'image/jpeg', fileName: 'photo.jpg' }],
    })

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/feedback/save_feedbacks',
      expect.any(FormData),
      {
        headers: {
          Authorization: 'Bearer secure-token',
          'Content-Type': 'multipart/form-data',
        },
      },
    )
  })
})
