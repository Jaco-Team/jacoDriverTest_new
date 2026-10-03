import { useGEOStore, useGlobalStore, useOrdersStore } from '@/shared/store/store'
import { setAppOffline } from '@/shared/lib/connectivityState'
import { OFFLINE_ORDER_ACTION_MESSAGE } from '@/shared/lib/offlineOrderAction'
import * as ApiModule from '@/shared/store/api'

const originalSetActiveConfirm = useOrdersStore.getState().setActiveConfirm

describe('действия с заказом без интернета', () => {
  afterEach(() => {
    setAppOffline(false)
    useOrdersStore.setState({ setActiveConfirm: originalSetActiveConfirm })
    jest.restoreAllMocks()
  })

  it.each([1, 2, 3])('не запускает действие %i, геолокацию и API', type => {
    const checkPos = jest.fn()
    const checkPosFake = jest.fn()
    const setSpinner = jest.fn()
    const showModalText = jest.fn()
    const setActiveConfirm = jest.fn()
    const api = jest.spyOn(ApiModule, 'api')

    useGEOStore.setState({ check_pos: checkPos, check_pos_fake: checkPosFake })
    useGlobalStore.setState({ setSpinner, showModalText })
    useOrdersStore.setState({
      isClick: false,
      is_modalConfirm: true,
      setActiveConfirm,
    })
    setAppOffline(true)

    useOrdersStore.getState().actionButtonOrder(type, 910001)

    expect(setActiveConfirm).toHaveBeenCalledWith(false)
    expect(showModalText).toHaveBeenCalledWith(true, OFFLINE_ORDER_ACTION_MESSAGE)
    expect(setSpinner).not.toHaveBeenCalled()
    expect(checkPos).not.toHaveBeenCalled()
    expect(checkPosFake).not.toHaveBeenCalled()
    expect(api).not.toHaveBeenCalled()
    expect(useOrdersStore.getState().isClick).toBe(false)
  })

  it('показывает сообщение сразу, не открывая подтверждение', () => {
    const showModalText = jest.fn()
    useGlobalStore.setState({ showModalText })
    useOrdersStore.setState({ is_modalConfirm: false, isClick: false })
    setAppOffline(true)

    useOrdersStore.getState().setActiveConfirm(true, 910002, 'finish', false)

    expect(useOrdersStore.getState().is_modalConfirm).toBe(false)
    expect(showModalText).toHaveBeenCalledWith(true, OFFLINE_ORDER_ACTION_MESSAGE)
  })

  it('останавливает запрос, если связь пропала после проверки геолокации', async () => {
    const api = jest.spyOn(ApiModule, 'api')
    const showModalText = jest.fn()
    const setSpinner = jest.fn()
    useGlobalStore.setState({ showModalText, setSpinner })
    setAppOffline(true)

    await useOrdersStore.getState().actionOrder({ data: { order_id: 910003, type: 1 } })
    await useOrdersStore.getState().actionOrderFake({ data: { order_id: 910003 } })

    expect(api).not.toHaveBeenCalled()
    expect(showModalText).toHaveBeenCalledTimes(2)
    expect(setSpinner).toHaveBeenCalledWith(false)
  })
})
