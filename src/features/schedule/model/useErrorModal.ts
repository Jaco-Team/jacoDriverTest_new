import { useState, useEffect } from 'react'

import { useStatStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'

export function useErrorCamera() {
  const [ globalFontSize ] = useGlobalStore(useShallow( state => [ state.globalFontSize ]));
  const [ isShowModalErrCam, modalErrCam, showModalErrCam, FormatPrice, answer_err_cam ] = useStatStore(useShallow( state => [ state.isShowModalErrCam, state.modalErrCam, state.showModalErrCam, state.FormatPrice, state.answer_err_cam ]));

  const [visible, setVisible] = useState<boolean>(false);
  const [indexImg, setIndexImg] = useState<number>(0);
  const [transformedArray, setTransformedArray] = useState<{ uri: string }[]>([]);
  const [errorText, setTextError] = useState<string>('');

  // Преобразуем массив изображений
  useEffect(() => {
    const arr = modalErrCam?.imgs?.map((uri) => ({ uri })) ?? []
    setTransformedArray(arr)
  }, [modalErrCam])

  // Функция закрытия модалки
  const closeModal = () => {
    showModalErrCam(false)
  }

  // Открыть полноэкранный просмотр изображения
  const openImage = (index: number) => {
    setIndexImg(index)
    setVisible(true)
  }

  // Подтверждение (ответ на ошибку)
  const onSubmitError = () => {
    answer_err_cam(errorText, modalErrCam?.id ?? 0)
  }

  return {
    // Из стора:
    isShowModalErrCam,
    modalErrCam,
    FormatPrice,

    // Локальные стейты и методы
    globalFontSize,
    visible,
    setVisible,
    indexImg,
    transformedArray,
    errorText,
    setTextError,

    closeModal,
    openImage,
    onSubmitError
  }
}

export function useErrorOrders() {
  const [
    isShowModalErrOrder,
    modalErrOrder,
    showModalErrOrder,
    FormatPrice,
    answer_err_order,
  ] = useStatStore(
    useShallow((state) => [
      state.isShowModalErrOrder,
      state.modalErrOrder,
      state.showModalErrOrder,
      state.FormatPrice,
      state.answer_err_order
    ])
  )

  const [globalFontSize] = useGlobalStore(useShallow((state) => [state.globalFontSize]))

  // Локальные стейты
  const [visible, setVisible] = useState(false)
  const [indexImg, setIndexImg] = useState(0)
  const [transformedArray, setTransformedArray] = useState<{ uri: string }[]>([])
  const [errorText, setTextError] = useState("")

  // При изменении modalErrOrder пересобираем массив изображений
  useEffect(() => {
    const arr = modalErrOrder?.imgs?.map((uri: string) => ({ uri })) ?? []
    setTransformedArray(arr)
  }, [modalErrOrder])

  // Закрытие модалки
  const closeModal = () => {
    showModalErrOrder(false)
  }

  // Открыть fullscreen просмотр изображения
  const openImage = (index: number) => {
    setIndexImg(index)
    setVisible(true)
  }

  // Обжаловать ошибку
  const submitError = () => {
    if (!modalErrOrder) return
    answer_err_order(errorText, modalErrOrder.err_id, modalErrOrder.row_id)
  }

  return {
    isShowModalErrOrder,
    modalErrOrder,
    FormatPrice,
    globalFontSize,
    visible,
    setVisible,
    indexImg,
    transformedArray,
    errorText,
    setTextError,
    closeModal,
    openImage,
    submitError,
  }
}