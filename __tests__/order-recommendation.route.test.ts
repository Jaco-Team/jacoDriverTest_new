import {
  formatRecommendationDistance,
  recommendationStopLabel,
  sortRecommendationStops,
} from '@/features/order-recommendation/model/recommendationRoute'

describe('представление маршрута ИИ-подсказки', () => {
  it('сортирует шаги и формирует понятные подписи', () => {
    const stops = sortRecommendationStops([
      {id: 10, kind: 'delivery', seq: 3, eta: '12:30'},
      {id: null, kind: 'start', seq: 1, eta: '12:00'},
      {id: 10, kind: 'pickup', seq: 2, eta: '12:10'},
    ])
    const order = {
      id: 10,
      id_text: '#10 Готов',
      addr: 'улица Ленина, 1',
    } as any

    expect(stops.map(stop => stop.seq)).toEqual([1, 2, 3])
    expect(recommendationStopLabel(stops[0])).toBe('Текущее местоположение')
    expect(recommendationStopLabel(stops[1], order)).toBe('Забрать #10 Готов')
    expect(recommendationStopLabel(stops[2], order)).toBe(
      'Доставить #10 Готов · улица Ленина, 1',
    )
  })

  it('форматирует расстояние в метрах и километрах', () => {
    expect(formatRecommendationDistance(850)).toBe('850 м')
    expect(formatRecommendationDistance(6050)).toBe('6.0 км')
    expect(formatRecommendationDistance(null)).toBeNull()
  })
})
