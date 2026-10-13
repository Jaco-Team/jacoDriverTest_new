import {act, waitFor} from '@testing-library/react-native'

import * as ApiModule from '@/shared/store/api'
import {
  useGEOStore,
  useGlobalStore,
  useOrdersStore,
} from '@/shared/store/store'
import {subscribeOrderTakeStarted} from '@/shared/lib/orderActionEvents'

describe('закрытие карточки заказа после успешного действия', () => {
  it('закрывает шторку и очищает выбранный заказ после «Взять»', async () => {
    const onTakeStarted = jest.fn()
    const unsubscribe = subscribeOrderTakeStarted(onTakeStarted)
    jest.spyOn(ApiModule, 'api').mockResolvedValueOnce({st: true, text: ''})
    useGlobalStore.setState({
      getAuthToken: jest.fn().mockResolvedValue('token'),
      setSpinner: jest.fn(),
    })
    useGEOStore.setState({
      check_pos_fake: jest.fn((callback, payload) => {
        void callback({data: payload, latitude: '', longitude: ''})
      }),
    })
    useOrdersStore.setState({
      driver_need_gps: false,
      getOrders: jest.fn(),
      isClick: false,
      isOpenOrderMap: true,
      is_modalConfirm: false,
      showOrders: [{id: 900003}] as any,
      type_confirm: '',
    })

    await act(async () => {
      useOrdersStore.getState().actionButtonOrder(1, 900003)
    })

    expect(onTakeStarted).toHaveBeenCalledWith(900003)

    await waitFor(() => {
      expect(useOrdersStore.getState().isOpenOrderMap).toBe(false)
    })
    expect(useOrdersStore.getState().showOrders).toEqual([])
    unsubscribe()
  })
})
