import { useGlobalStore, useLoginStore, useOrdersStore, useSettingsStore, useStatStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'
import { useDialCall } from '@/shared/lib/useDialCall'

export function useModalOrderLogic() {
  // zustand
  const [FormatPrice] = useStatStore(useShallow((state) => [state.FormatPrice]))
  const [globalFontSize, showAlertText] = useGlobalStore(
    useShallow((state) => [state.globalFontSize, state.showAlertText])
  )
  const [
    showOrders,
    isOpenOrderMap,
    showOrdersMap,
    actionButtonOrder,
    setActiveConfirm,
    isClick,
    isLoad,
    mapOrderSession,
  ] =
    useOrdersStore(
      useShallow((state) => [
        state.showOrders,
        state.isOpenOrderMap,
        state.showOrdersMap,
        state.actionButtonOrder,
        state.setActiveConfirm,
        state.isClick,
        state.is_load,
        state.mapOrderSession,
      ])
    )

  // Вызов кастомного хука для звонков
  const dialCall = useDialCall()

  return {
    FormatPrice,
    globalFontSize,
    showAlertText,
    showOrders,
    isOpenOrderMap,
    showOrdersMap,
    actionButtonOrder,
    setActiveConfirm,
    dialCall,
    isBusy: isClick || isLoad,
    mapOrderSession,
  }
}

export function useModalFilterOrdersLogic() {
  const globalFontSize = useGlobalStore((state) => state.globalFontSize)
  const ownerId = useLoginStore((state) =>
    String(state.currentUser?.user_id ?? state.currentUser?.login ?? 'session'),
  )
  const pointId = useSettingsStore((state) => state.point_id ?? null)
  const activeOrdersCacheKey = JSON.stringify([ownerId, pointId, 1])
  const [types_dop, type_dop, is_showModalTypeDop, showModalTypeDop, setTypeDop, activeOrders, typeToStatus] =
    useOrdersStore(
      useShallow((state) => [
        state.types_dop,
        state.type_dop,
        state.is_showModalTypeDop,
        state.showModalTypeDop,
        state.setTypeDop,
        state.ordersCache[activeOrdersCacheKey],
        state.typeToStatus,
      ])
    )
  const statusCounts = Object.fromEntries(
    types_dop.map((item) => [
      String(item.id),
      (activeOrders ?? []).filter((order) => order.status === typeToStatus[String(item.id)]).length,
    ]),
  )

  return {
    globalFontSize,
    types_dop, 
    type_dop, 
    is_showModalTypeDop, 
    showModalTypeDop, 
    setTypeDop,
    statusCounts,
  }
}
