import {
  buildRecommendationRouteMapPoints,
  buildYandexMapsRouteUrl,
  extractRecommendationRoadPoints,
} from '@/features/order-recommendation/model/recommendationRouteMap'

describe('точки карты ИИ-маршрута', () => {
  const orders = new Map([
    [1, {id: 1, id_text: '#1', addr: 'улица Ленина, 1'} as any],
    [2, {id: 2, id_text: '#2', addr: 'улица Ленина, 1'} as any],
  ])

  it('объединяет соседние шаги с одинаковыми координатами', () => {
    const points = buildRecommendationRouteMapPoints([
      {id: null, kind: 'start', seq: 1, eta: '18:20', lat: 53.5, lon: 49.3},
      {id: 1, kind: 'pickup', seq: 2, eta: '18:25', lat: 53.5, lon: 49.3},
      {id: 2, kind: 'pickup', seq: 3, eta: '18:26', lat: 53.5, lon: 49.3},
      {id: 1, kind: 'delivery', seq: 4, eta: '18:35', lat: 53.51, lon: 49.31},
      {id: 2, kind: 'delivery', seq: 5, eta: '18:36', lat: 53.51, lon: 49.31},
    ], orders)

    expect(points).toHaveLength(2)
    expect(points[0]).toEqual(expect.objectContaining({
      label: '1–3',
      kind: 'pickup',
      title: 'Старт здесь · Забрать 2 заказа в кафе',
      eta: '18:20–18:26',
      orderIds: [1, 2],
    }))
    expect(points[1]).toEqual(expect.objectContaining({
      label: '4–5',
      title: 'Доставить 2 заказа',
      subtitle: 'улица Ленина, 1',
      orderIds: [1, 2],
    }))
  })

  it('не склеивает несоседние возвраты в ту же точку', () => {
    const points = buildRecommendationRouteMapPoints([
      {id: null, kind: 'start', seq: 1, lat: 53.5, lon: 49.3},
      {id: 1, kind: 'delivery', seq: 2, lat: 53.51, lon: 49.31},
      {id: 2, kind: 'delivery', seq: 3, lat: 53.5, lon: 49.3},
    ], orders)

    expect(points.map(point => point.label)).toEqual(['1', '2', '3'])
  })

  it('отбрасывает невалидные точки и собирает URL маршрута', () => {
    const points = buildRecommendationRouteMapPoints([
      {id: null, kind: 'start', seq: 1, lat: 0, lon: 0},
      {id: 1, kind: 'pickup', seq: 2, lat: 53.5, lon: 49.3},
      {id: 1, kind: 'delivery', seq: 3, lat: 53.51, lon: 49.31},
    ], orders)

    expect(points).toHaveLength(2)
    expect(buildYandexMapsRouteUrl(points)).toBe(
      'https://yandex.ru/maps/?rtext=53.500000,49.300000~53.510000,49.310000&rtt=auto',
    )
  })

  it('извлекает iOS-геометрию даже при перепутанном status библиотеки', () => {
    expect(extractRecommendationRoadPoints({
      routes: [{
        sections: [{
          points: [
            {lat: 53.5, lon: 49.3},
            {lat: '53.51', lon: '49.31'},
            {lat: 0, lon: 0},
          ],
        }],
      }],
    })).toEqual([
      {lat: 53.5, lon: 49.3},
      {lat: 53.51, lon: 49.31},
    ])
  })
})
