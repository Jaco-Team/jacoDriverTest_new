const mockGet = jest.fn()
const mockPost = jest.fn()
const mockGetLaravelAuthToken = jest.fn()
const OriginalFormData = (globalThis as any).FormData

class TestFormData {
  private readonly values = new Map<string, unknown[]>()

  append(name: string, value: unknown): void {
    this.values.set(name, [...(this.values.get(name) ?? []), value])
  }

  get(name: string): unknown {
    return this.values.get(name)?.[0] ?? null
  }

  getAll(name: string): unknown[] {
    return this.values.get(name) ?? []
  }
}

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
  beforeAll(() => {
    ;(globalThis as any).FormData = TestFormData
  })

  afterAll(() => {
    ;(globalThis as any).FormData = OriginalFormData
  })

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

    const formData = mockPost.mock.calls[0][1] as TestFormData
    expect(formData.get('title')).toBe('Ошибка карты')
    expect(formData.get('description')).toBe('Описание')
    expect(formData.get('type')).toBe('ошибка')
    expect(formData.get('is_need_notification')).toBe('1')
    expect(formData.getAll('images[]')).toEqual([
      { uri: 'file://photo.jpg', type: 'image/jpeg', name: 'photo.jpg' },
    ])
  })

  it('keeps emoji, unicode and every image in the multipart payload', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true, id: 8 } })

    await createLaravelFeedback({
      title: 'LOCAL EMOJI TEST 😀🔥👍',
      description: 'Кавычки: "двойные" Unicode: Привет 世界 café <script>test()</script>',
      type: 'другое',
      is_need_notification: 0,
      images: [
        { uri: 'file://one.png', type: 'image/png', fileName: 'one.png' },
        { uri: 'file://two.png', type: 'image/png', fileName: 'two.png' },
      ],
    })

    const formData = mockPost.mock.calls[0][1] as TestFormData
    expect(formData.get('title')).toBe('LOCAL EMOJI TEST 😀🔥👍')
    expect(formData.get('description')).toBe(
      'Кавычки: "двойные" Unicode: Привет 世界 café <script>test()</script>',
    )
    expect(formData.getAll('images[]')).toEqual([
      { uri: 'file://one.png', type: 'image/png', name: 'one.png' },
      { uri: 'file://two.png', type: 'image/png', name: 'two.png' },
    ])
  })
})
