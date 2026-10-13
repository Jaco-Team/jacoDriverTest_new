import {create} from 'zustand'

import type {Order} from '@/shared/store/OrdersStoreType'

import type {OrderRecommendationResult} from './orderRecommendation.types'

export type OrderRecommendationSurface = 'list' | 'map'

interface OrderRecommendationState {
  result: OrderRecommendationResult | null
  signature: string | null
  orderTypeId: number | null
  presenter: OrderRecommendationSurface | null
  isOpen: boolean
  isLoading: boolean
  requestVersion: number
  isRouteVisible: boolean
  acceptedOrderIds: number[]
  unavailableOrderIds: number[]
  orderSnapshots: Record<number, Order>
  open: (presenter: OrderRecommendationSurface) => void
  close: () => void
  showRoute: () => void
  hideRoute: () => void
  reset: () => void
  cancelPending: () => void
  applySuccessfulOrderAction: (
    orderId: number,
    type: 'take' | 'cancel' | 'finish',
  ) => void
  reconcileOrders: (availableOrderIds: number[], myOrderIds: number[]) => void
  start: () => number
  succeed: (
    requestVersion: number,
    result: OrderRecommendationResult,
    signature: string,
    presenter: OrderRecommendationSurface,
    orderTypeId: number,
    orders: Order[],
  ) => void
  finish: (requestVersion: number) => void
}

export const useOrderRecommendationStore = create<OrderRecommendationState>((set, get) => ({
  result: null,
  signature: null,
  orderTypeId: null,
  presenter: null,
  isOpen: false,
  isLoading: false,
  requestVersion: 0,
  isRouteVisible: false,
  acceptedOrderIds: [],
  unavailableOrderIds: [],
  orderSnapshots: {},
  open: presenter => set({isOpen: true, presenter}),
  close: () => set({isOpen: false}),
  showRoute: () => set({isOpen: false, isRouteVisible: true}),
  hideRoute: () => set({isRouteVisible: false}),
  reset: () => set(state => ({
    result: null,
    signature: null,
    orderTypeId: null,
    presenter: null,
    isOpen: false,
    isLoading: false,
    isRouteVisible: false,
    acceptedOrderIds: [],
    unavailableOrderIds: [],
    orderSnapshots: {},
    requestVersion: state.requestVersion + 1,
  })),
  cancelPending: () => set(state => state.isLoading
    ? {
        result: null,
        signature: null,
        orderTypeId: null,
        presenter: null,
        isOpen: false,
        isLoading: false,
        isRouteVisible: false,
        acceptedOrderIds: [],
        unavailableOrderIds: [],
        orderSnapshots: {},
        requestVersion: state.requestVersion + 1,
      }
    : state),
  applySuccessfulOrderAction: (orderId, type) => set(state => {
    // Анализ, который шёл в момент нажатия «Взять», уже отменён событием
    // orderTakeStarted. Поздний успешный ответ не должен отменять новый анализ,
    // который курьер успел запустить после этого.
    const recommendedIds = new Set(state.result?.take?.map(item => item.id) ?? [])
    if (!state.result || !recommendedIds.has(orderId)) {
      return type === 'take' && state.result
        ? {
            result: null,
            signature: null,
            orderTypeId: null,
            presenter: null,
            isOpen: false,
            isLoading: false,
            isRouteVisible: false,
            acceptedOrderIds: [],
            unavailableOrderIds: [],
            orderSnapshots: {},
          }
        : state
    }

    if (type !== 'take') {
      return {
        unavailableOrderIds: [...new Set([...state.unavailableOrderIds, orderId])],
        acceptedOrderIds: state.acceptedOrderIds.filter(id => id !== orderId),
      }
    }

    return {
      acceptedOrderIds: [...new Set([...state.acceptedOrderIds, orderId])],
      unavailableOrderIds: state.unavailableOrderIds.filter(id => id !== orderId),
    }
  }),
  reconcileOrders: (availableOrderIds, myOrderIds) => set(state => {
    const recommendedIds = state.result?.take?.map(item => item.id) ?? []
    if (recommendedIds.length === 0) return state

    const available = new Set(availableOrderIds)
    const mine = new Set(myOrderIds)
    const accepted = new Set(state.acceptedOrderIds)
    recommendedIds.forEach(id => {
      if (mine.has(id)) accepted.add(id)
    })
    const unavailable = recommendedIds.filter(
      id => !available.has(id) && !mine.has(id) && !accepted.has(id),
    )

    if (unavailable.length === recommendedIds.length) {
      return {
        result: null,
        signature: null,
        orderTypeId: null,
        presenter: null,
        isOpen: false,
        isLoading: false,
        isRouteVisible: false,
        acceptedOrderIds: [],
        unavailableOrderIds: [],
        orderSnapshots: {},
      }
    }

    return {
      acceptedOrderIds: [...accepted],
      unavailableOrderIds: unavailable,
    }
  }),
  start: () => {
    const requestVersion = get().requestVersion + 1
    set({requestVersion, isLoading: true, isRouteVisible: false})
    return requestVersion
  },
  succeed: (requestVersion, result, signature, presenter, orderTypeId, orders) => set(state =>
    state.requestVersion === requestVersion
      ? {
          result,
          signature,
          orderTypeId,
          presenter,
          isOpen: false,
          isRouteVisible: true,
          acceptedOrderIds: [],
          unavailableOrderIds: [],
          orderSnapshots: Object.fromEntries(orders.map(order => [order.id, order])),
        }
      : state,
  ),
  finish: requestVersion => set(state =>
    state.requestVersion === requestVersion ? {isLoading: false} : state,
  ),
}))
