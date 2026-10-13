import {useCallback, useEffect, useMemo, useState} from 'react'
import {useShallow} from 'zustand/react/shallow'

import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService'
import {getLaravelApiErrorInfo} from '@/shared/api/laravel/errors'
import {isAppOffline} from '@/shared/lib/connectivityState'
import {
  subscribeOrderTakeStarted,
  subscribeSuccessfulOrderAction,
} from '@/shared/lib/orderActionEvents'
import {
  useGlobalStore,
  useLoginStore,
  useOrdersStore,
  useSettingsStore,
} from '@/shared/store/store'

import {requestOrderRecommendation} from '../api/orderRecommendation.api'
import {buildOrderRecommendationRequest} from './buildOrderRecommendationRequest'
import {getRecommendationCourierLocation} from './getRecommendationCourierLocation'
import {
  type OrderRecommendationSurface,
  useOrderRecommendationStore,
} from './orderRecommendation.store'
import {buildOrderRecommendationSignature} from './orderRecommendationSignature'
import {resolveRecommendationPointId} from './resolveRecommendationPointId'

export function useOrderRecommendation(surface: OrderRecommendationSurface = 'list') {
  const [isNoSuitableOpen, setIsNoSuitableOpen] = useState(false)
  const {
    close: closeStore,
    cancelPending,
    acceptedOrderIds,
    applySuccessfulOrderAction,
    finish,
    hideRoute,
    isLoading,
    isOpen: storeIsOpen,
    isRouteVisible,
    open,
    orderTypeId,
    presenter,
    result,
    orderSnapshots,
    reconcileOrders,
    reset,
    unavailableOrderIds,
    showRoute,
    start,
    succeed,
  } = useOrderRecommendationStore()
  const [selectedPointId, points, getSettings, aiRecommend] = useSettingsStore(
    useShallow(state => [state.point_id, state.points, state.getSettings, state.ai_recommend]),
  )
  const aiRecommendEnabled = Number(aiRecommend) === 1
  const currentUser = useLoginStore(state => state.currentUser)
  const showAlertText = useGlobalStore(state => state.showAlertText)
  const [orders, ordersCache, type, limit, limitCount] = useOrdersStore(
    useShallow(state => [
      state.orders,
      state.ordersCache,
      state.type,
      state.limit_summ,
      state.limit_count,
    ]),
  )
  const recommendationOrders = useMemo(
    () => orders.filter(order =>
      Number(order.is_delete ?? 0) !== 1 && Number(order.status_order ?? 0) !== 6,
    ),
    [orders],
  )

  const currentPointId = useMemo(
    () => resolveRecommendationPointId({
      selectedPointId,
      userPointId: currentUser?.point_id ?? null,
      points,
      login: currentUser?.login ?? null,
    }),
    [
      currentUser?.login,
      currentUser?.point_id,
      points,
      selectedPointId,
    ],
  )
  const hasCurrentResult = Boolean(result && orderTypeId === type.id)
  const isVisible = aiRecommendEnabled && type.id === 1 && (recommendationOrders.length > 0 || hasCurrentResult)
  const isOpen = storeIsOpen && presenter === surface
  const displayOrders = useMemo(() => {
    const merged = new Map<number, (typeof orders)[number]>()
    Object.values(orderSnapshots).forEach(order => merged.set(order.id, order))
    orders.forEach(order => merged.set(order.id, order))
    return [...merged.values()]
  }, [orderSnapshots, orders])

  useEffect(
    () => subscribeSuccessfulOrderAction(action => {
      applySuccessfulOrderAction(action.orderId, action.type)
    }),
    [applySuccessfulOrderAction],
  )

  useEffect(
    () => subscribeOrderTakeStarted(() => cancelPending()),
    [cancelPending],
  )

  useEffect(() => {
    if (aiRecommendEnabled) return
    setIsNoSuitableOpen(false)
    reset()
  }, [aiRecommendEnabled, reset])

  useEffect(() => {
    if (!result || orderTypeId !== 1) return

    const knownOrders = [...orders, ...Object.values(ordersCache).flat()]
    const availableOrderIds = knownOrders
      .filter(order =>
        Number(order.is_my ?? 0) !== 1 &&
        Number(order.is_get ?? 0) !== 1 &&
        Number(order.is_delete ?? 0) !== 1 &&
        Number(order.status_order ?? 0) !== 6,
      )
      .map(order => order.id)
    const myOrderIds = knownOrders
      .filter(order => Number(order.is_my ?? 0) === 1)
      .map(order => order.id)

    reconcileOrders(availableOrderIds, myOrderIds)
  }, [orderTypeId, orders, ordersCache, reconcileOrders, result])

  const request = useCallback(async () => {
    if (isLoading) return false

    if (!hasCurrentResult && recommendationOrders.length === 0) {
      showAlertText(true, 'Нет заказов, для которых можно построить маршрут.', 'warning')
      return false
    }

    if (isAppOffline()) {
      showAlertText(true, 'Для ИИ-подсказки нужен интернет.', 'warning')
      return false
    }

    if (surface === 'map' && hasCurrentResult && isRouteVisible && orderTypeId === type.id) {
      open(surface)
      Analytics.log(
        AnalyticsEvent.OrderRecommendationOpen,
        'Открыта готовая ИИ-подсказка по заказам',
      )
      return true
    }

    if (hasCurrentResult) {
      showRoute()
      Analytics.log(
        AnalyticsEvent.OrderRecommendationOpen,
        'Повторно открыта ИИ-подсказка по заказам',
      )
      return true
    }

    const requestVersion = start()
    setIsNoSuitableOpen(false)
    const isCurrentRequest = () =>
      useOrderRecommendationStore.getState().requestVersion === requestVersion
    Analytics.log(
      AnalyticsEvent.OrderRecommendationRequest,
      'Запрошена ИИ-подсказка по активным заказам',
    )

    try {
      let pointId = resolveRecommendationPointId({
        selectedPointId,
        userPointId: currentUser?.point_id ?? null,
        points,
        login: currentUser?.login ?? null,
      })

      if (pointId === null) {
        await getSettings(true)
        if (!isCurrentRequest()) return false
        const settings = useSettingsStore.getState()
        const user = useLoginStore.getState().currentUser
        pointId = resolveRecommendationPointId({
          selectedPointId: settings.point_id,
          userPointId: user?.point_id ?? null,
          points: settings.points,
          login: user?.login ?? null,
        })
      }

      if (pointId === null) {
        if (!isCurrentRequest()) return false
        showAlertText(
          true,
          'Не выбрано кафе. Выберите кафе в настройках и повторите запрос.',
          'warning',
        )
        return false
      }

      const courier = await getRecommendationCourierLocation()
      if (!isCurrentRequest()) return false
      const payload = buildOrderRecommendationRequest({
        orders: recommendationOrders,
        pointId,
        limit,
        limitCount,
        courier,
      })
      const nextResult = await requestOrderRecommendation(payload)
      if (!isCurrentRequest()) return false

      if (
        nextResult.code === 'no_suitable_orders' ||
        (nextResult.st && (nextResult.take?.length ?? 0) === 0)
      ) {
        setIsNoSuitableOpen(true)
        return false
      }

      if (!nextResult.st) {
        throw new Error(nextResult.text || 'Не удалось получить ИИ-подсказку.')
      }

      const requestSignature = buildOrderRecommendationSignature({
        orders: recommendationOrders,
        pointId,
        limit,
        limitCount,
      })
      succeed(
        requestVersion,
        nextResult,
        requestSignature,
        surface,
        type.id,
        recommendationOrders,
      )
      Analytics.log(
        AnalyticsEvent.OrderRecommendationOpen,
        'Открыта ИИ-подсказка по заказам',
      )
      return true
    } catch (error) {
      if (!isCurrentRequest()) return false
      const message = error instanceof Error && !('response' in error)
        ? error.message
        : getLaravelApiErrorInfo(error).message

      showAlertText(true, message, 'error')
      Analytics.reportError('order_recommendation_failed', error, {
        ordersCount: recommendationOrders.length,
        pointId: selectedPointId,
      })
      return false
    } finally {
      finish(requestVersion)
    }
  }, [
    currentUser?.login,
    currentUser?.point_id,
    getSettings,
    finish,
    hasCurrentResult,
    isLoading,
    isRouteVisible,
    limit,
    limitCount,
    orderTypeId,
    open,
    recommendationOrders,
    points,
    selectedPointId,
    showAlertText,
    showRoute,
    start,
    succeed,
    surface,
    type.id,
  ])

  const close = useCallback(() => {
    closeStore()
    Analytics.log(
      AnalyticsEvent.OrderRecommendationClose,
      'Закрыта ИИ-подсказка по заказам',
    )
  }, [closeStore])

  return {
    close,
    hideRoute,
    reset,
    acceptedOrderIds,
    unavailableOrderIds,
    isLoading,
    isNoSuitableOpen,
    isOpen,
    isRouteVisible: isRouteVisible && orderTypeId === type.id,
    isVisible,
    orders: displayOrders,
    orderTypeId: type.id,
    request,
    result: hasCurrentResult ? result : null,
    showRoute,
    closeNoSuitable: () => setIsNoSuitableOpen(false),
  }
}
