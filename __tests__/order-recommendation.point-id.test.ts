import {resolveRecommendationPointId} from '@/features/order-recommendation/model/resolveRecommendationPointId'

describe('кафе для ИИ-подсказки', () => {
  it('использует выбранное кафе раньше остальных источников', () => {
    expect(resolveRecommendationPointId({
      selectedPointId: 12,
      userPointId: 9,
      points: [{id: 7, name: 'Кафе'}],
      login: '79990000001',
    })).toBe(12)
  })

  it('использует кафе профиля или первое разрешённое кафе', () => {
    expect(resolveRecommendationPointId({
      selectedPointId: null,
      userPointId: 9,
      points: [{id: 7, name: 'Кафе'}],
      login: null,
    })).toBe(9)
    expect(resolveRecommendationPointId({
      selectedPointId: null,
      userPointId: null,
      points: [{id: 7, name: 'Кафе'}],
      login: null,
    })).toBe(7)
  })

  it('подставляет техническую точку только демо-аккаунту', () => {
    expect(resolveRecommendationPointId({
      selectedPointId: null,
      userPointId: null,
      points: [],
      login: '79990000001',
    })).toBe(1)
    expect(resolveRecommendationPointId({
      selectedPointId: null,
      userPointId: null,
      points: [],
      login: '79990000002',
    })).toBeNull()
  })
})
