import {useOrderRecommendationStore} from '@/features/order-recommendation/model/orderRecommendation.store'

const recommendation = {
  st: true,
  take: [
    {id: 1, seq: 1, reason: 'Первый'},
    {id: 2, seq: 2, reason: 'Второй'},
  ],
  route: {
    stops: [
      {id: 1, kind: 'pickup' as const, seq: 1},
      {id: 2, kind: 'pickup' as const, seq: 2},
    ],
  },
}

const orders = [
  {id: 1, id_text: '#1'} as any,
  {id: 2, id_text: '#2'} as any,
]

describe('состояние ИИ-рекомендации', () => {
  beforeEach(() => {
    useOrderRecommendationStore.getState().reset()
    const requestVersion = useOrderRecommendationStore.getState().start()
    useOrderRecommendationStore.getState().succeed(
      requestVersion,
      recommendation,
      'signature',
      'map',
      1,
      orders,
    )
    useOrderRecommendationStore.getState().finish(requestVersion)
  })

  it('оставляет подборку после взятия рекомендованного заказа', () => {
    useOrderRecommendationStore.getState().applySuccessfulOrderAction(1, 'take')

    const state = useOrderRecommendationStore.getState()
    expect(state.result).toBe(recommendation)
    expect(state.isRouteVisible).toBe(true)
    expect(state.acceptedOrderIds).toEqual([1])
  })

  it('убирает только недоступный заказ и сохраняет остальные', () => {
    useOrderRecommendationStore.getState().applySuccessfulOrderAction(1, 'take')
    useOrderRecommendationStore.getState().reconcileOrders([], [1])

    const state = useOrderRecommendationStore.getState()
    expect(state.result).toBe(recommendation)
    expect(state.acceptedOrderIds).toEqual([1])
    expect(state.unavailableOrderIds).toEqual([2])
  })

  it('сбрасывает подборку после взятия заказа вне рекомендации', () => {
    useOrderRecommendationStore.getState().applySuccessfulOrderAction(99, 'take')

    const state = useOrderRecommendationStore.getState()
    expect(state.result).toBeNull()
    expect(state.isRouteVisible).toBe(false)
    expect(state.orderSnapshots).toEqual({})
  })

  it('игнорирует результат анализа, отменённого началом взятия заказа', () => {
    useOrderRecommendationStore.getState().reset()
    const requestVersion = useOrderRecommendationStore.getState().start()

    useOrderRecommendationStore.getState().cancelPending()
    useOrderRecommendationStore.getState().succeed(
      requestVersion,
      recommendation,
      'stale-signature',
      'map',
      1,
      orders,
    )
    useOrderRecommendationStore.getState().finish(requestVersion)

    const state = useOrderRecommendationStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.result).toBeNull()
    expect(state.isRouteVisible).toBe(false)
  })

  it('не отменяет новый анализ поздним ответом предыдущего взятия', () => {
    useOrderRecommendationStore.getState().reset()
    useOrderRecommendationStore.getState().start()
    useOrderRecommendationStore.getState().cancelPending()

    const nextRequestVersion = useOrderRecommendationStore.getState().start()
    useOrderRecommendationStore.getState().applySuccessfulOrderAction(1, 'take')

    expect(useOrderRecommendationStore.getState().isLoading).toBe(true)
    expect(useOrderRecommendationStore.getState().requestVersion).toBe(nextRequestVersion)

    useOrderRecommendationStore.getState().succeed(
      nextRequestVersion,
      recommendation,
      'next-signature',
      'map',
      1,
      orders,
    )
    useOrderRecommendationStore.getState().finish(nextRequestVersion)

    expect(useOrderRecommendationStore.getState().result).toBe(recommendation)
    expect(useOrderRecommendationStore.getState().isRouteVisible).toBe(true)
  })
})
