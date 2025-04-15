import { useRef, useMemo, useCallback, useEffect } from 'react'
import BottomSheet from '@gorhom/bottom-sheet'
import { useGlobalStore, useOrdersStore, useStatStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'
import { useDialCall } from '@/shared/lib/useDialCall'

export function useModalOrderLogic() {
  // zustand
  const [FormatPrice] = useStatStore(useShallow((state) => [state.FormatPrice]))
  const [globalFontSize, showAlertText] = useGlobalStore(
    useShallow((state) => [state.globalFontSize, state.showAlertText])
  )
  const [showOrders, isOpenOrderMap, showOrdersMap, actionButtonOrder, setActiveConfirm] =
    useOrdersStore(
      useShallow((state) => [
        state.showOrders,
        state.isOpenOrderMap,
        state.showOrdersMap,
        state.actionButtonOrder,
        state.setActiveConfirm
      ])
    )

  // Вызов кастомного хука для звонков
  const dialCall = useDialCall()

  const bottomSheetRef = useRef<BottomSheet>(null)

  // Snap-пойнты
  const snapPoints = useMemo(() => ['25%', '50%', '75%'], [])

  // Колбэк при изменении положения шторки
  // const handleSheetChanges = useCallback(
  //   (index: number) => {
  //     if (index < 0) {
  //       // Если шторка закрылась
  //       showOrdersMap(-1)
  //     }
  //   },
  //   [showOrdersMap]
  // )

  //const sheetIndex = isOpenOrderMap ? 2 : -1
  const sheetIndex = 0;

  useEffect(() => {
    if(!isOpenOrderMap) {
      showOrdersMap(-1)
      bottomSheetRef.current?.close();
    }
  }, [isOpenOrderMap]);

  console.log( 'isOpenOrderMap', isOpenOrderMap )

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
    sheetIndex,
    bottomSheetRef,
    snapPoints,
    //handleSheetChanges
  }
}

export function useModalFilterOrdersLogic() {
  // zustand
  const [FormatPrice] = useStatStore(useShallow((state) => [state.FormatPrice]))
  const [globalFontSize, showAlertText] = useGlobalStore(
    useShallow((state) => [state.globalFontSize, state.showAlertText])
  )
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

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index < 0) {
        // Если шторка закрылась
        showModalTypeDop(false)
      }
    },
    [showModalTypeDop]
  )
  
  const bottomSheetRef = useRef<BottomSheet>(null)

  // Snap-пойнты
  const snapPoints = useMemo(() => ['25%', '50%'], [])

  const sheetIndex = is_showModalTypeDop ? 1 : -1

  

  return {
    globalFontSize,
    sheetIndex,
    bottomSheetRef,
    snapPoints,
    types_dop, 
    type_dop, 
    is_showModalTypeDop, 
    showModalTypeDop, 
    setTypeDop,
    handleSheetChanges
  }
}