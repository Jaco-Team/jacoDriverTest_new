import { normalizeFeedback } from './feedback'

describe('normalizeFeedback', () => {
  it('converts API image URLs to React Native image sources and removes duplicates', () => {
    const feedback = normalizeFeedback({
      id: 48,
      title: 'Несколько изображений',
      description: 'Тест',
      user: '',
      date_time_create: '2026-09-24 12:00:00',
      status: 1,
      answer: '',
      type: 'другое',
      link: 'https://example.test/1.png',
      images: [
        'https://example.test/1.png',
        'https://example.test/2.png',
        'https://example.test/3.png',
        'https://example.test/4.png',
      ],
    })

    expect(feedback.images).toEqual([
      { uri: 'https://example.test/1.png' },
      { uri: 'https://example.test/2.png' },
      { uri: 'https://example.test/3.png' },
      { uri: 'https://example.test/4.png' },
    ])
  })
})
