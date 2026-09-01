import { useGlobalStore, useOrdersStore, useStatStore } from '@/shared/store/store'
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
  }
}

export function useModalFilterOrdersLogic() {
  const globalFontSize = useGlobalStore((state) => state.globalFontSize)
  const [types_dop, type_dop, is_showModalTypeDop, showModalTypeDop, setTypeDop] =
    useOrdersStore(
      useShallow((state) => [
        state.types_dop,
        state.type_dop,
        state.is_showModalTypeDop,
        state.showModalTypeDop,
        state.setTypeDop
      ])
    )

  return {
    globalFontSize,
    types_dop, 
    type_dop, 
    is_showModalTypeDop, 
    showModalTypeDop, 
    setTypeDop,
  }
}
