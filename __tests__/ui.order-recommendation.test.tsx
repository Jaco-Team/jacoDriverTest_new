import React from 'react'
import {act, fireEvent, render, waitFor} from '@testing-library/react-native'

const mockRequestRecommendation = jest.fn()
const mockGetCourierLocation = jest.fn()

jest.mock('@/features/order-recommendation/api/orderRecommendation.api', () => ({
  requestOrderRecommendation: (...args: unknown[]) => mockRequestRecommendation(...args),
}))

jest.mock('@/features/order-recommendation/model/getRecommendationCourierLocation', () => ({
  getRecommendationCourierLocation: () => mockGetCourierLocation(),
}))

jest.mock('lucide-react-native', () => {
  const React = require('react')
  const {View} = require('react-native')

  return {
    AlertCircle: (props: any) => React.createElement(View, props),
    Check: (props: any) => React.createElement(View, props),
    ExternalLink: (props: any) => React.createElement(View, props),
    Route: (props: any) => React.createElement(View, props),
    Sparkles: (props: any) => React.createElement(View, props),
    X: (props: any) => React.createElement(View, props),
  }
})

import {OrderRecommendationSection} from '@/features/order-recommendation/ui/OrderRecommendationSection'
import {useOrderRecommendationStore} from '@/features/order-recommendation/model/orderRecommendation.store'
import {emitOrderTakeStarted} from '@/shared/lib/orderActionEvents'
import {
  useGlobalStore,
  useOrdersStore,
  useSettingsStore,
} from '@/shared/store/store'

const order = {
  id: 900003,
  id_text: '#900003 Готов на кухне 0%',
  addr: 'улица Гагарина, 3',
  status_order: 2,
  is_pred: 0,
  is_my: 0,
  count_pizza: 1,
  count_pasta: 0,
  count_other: 0,
  count_drink: 0,
  online_pay: 1,
  xy: {latitude: 53.5, longitude: 49.3},
} as any

describe('ИИ-подсказка в списке заказов', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCourierLocation.mockResolvedValue({lat: 53.5, lon: 49.3})
    useGlobalStore.setState({
      globalFontSize: 16,
      showAlertText: jest.fn(),
    })
    useSettingsStore.setState({point_id: 7, ai_recommend: 1})
    useOrderRecommendationStore.setState({
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
    })
    useOrdersStore.setState({
      orders: [order],
      type: {id: 1, text: 'Активные'},
      limit_summ: '12500 / 70000',
      limit_count: '1 / 6',
    })
  })

  it('показывает кнопку только для активных заказов', async () => {
    const screen = await render(<OrderRecommendationSection />)

    expect(screen.getByTestId('order-recommendation-button')).toBeTruthy()

    await act(async () => {
      useOrdersStore.setState({type: {id: 2, text: 'Мои'}})
    })

    await waitFor(() => {
      expect(screen.queryByTestId('order-recommendation-button')).toBeNull()
    })

    await act(async () => {
      useOrdersStore.setState({type: {id: 3, text: 'Предзаказы'}})
    })

    await waitFor(() => {
      expect(screen.queryByTestId('order-recommendation-button')).toBeNull()
    })
  })

  it('не показывает ИИ-подбор, пока курьер не включил его в настройках', async () => {
    useSettingsStore.setState({ai_recommend: 0})

    const screen = await render(<OrderRecommendationSection />)

    expect(screen.queryByTestId('order-recommendation-button')).toBeNull()
  })

  it('отправляет безопасный запрос и сразу включает маршрут', async () => {
    mockRequestRecommendation.mockResolvedValue({
      st: true,
      title: 'Лучше взять 1 заказ',
      summary: 'Заказ укладывается в лимит.',
      take: [
        {
          id: 900003,
          seq: 1,
          reason: 'Ближайший заказ.',
          pickup_at: '16:30',
          deliver_at: '16:42',
        },
      ],
      route: {
        total_minutes: 12,
        total_distance_m: 3500,
        stops: [
          {id: null, kind: 'start', seq: 1, eta: '16:25', lat: 53.5, lon: 49.3},
          {id: 900003, kind: 'pickup', seq: 2, eta: '16:30', lat: 53.5, lon: 49.3},
          {id: 900003, kind: 'delivery', seq: 3, eta: '16:42', lat: 53.51, lon: 49.31},
        ],
      },
    })
    const screen = await render(<OrderRecommendationSection />)

    await act(async () => {
      fireEvent.press(screen.getByTestId('order-recommendation-button'))
    })

    await waitFor(() => {
      expect(useOrderRecommendationStore.getState().isRouteVisible).toBe(true)
    })
    expect(useOrderRecommendationStore.getState().orderTypeId).toBe(1)
    expect(screen.queryByTestId('order-recommendation-sheet')).toBeNull()
    expect(screen.getByText('Подробнее')).toBeTruthy()
    expect(mockRequestRecommendation).toHaveBeenCalledTimes(1)
    expect(mockRequestRecommendation.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        point_id: 7,
        courier: {lat: 53.5, lon: 49.3},
      }),
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId('order-recommendation-button'))
    })
    expect(screen.getByText('Подробнее')).toBeTruthy()
    expect(useOrderRecommendationStore.getState().isRouteVisible).toBe(true)
    expect(mockRequestRecommendation).toHaveBeenCalledTimes(1)
  })

  it('использует на карте компактную кнопку и общий готовый результат', async () => {
    useOrderRecommendationStore.setState({
      result: {st: true, title: 'Готовый совет'},
      orderTypeId: 1,
      signature: 'устаревшая-сигнатура',
      presenter: null,
      isOpen: false,
      isRouteVisible: true,
    })

    const screen = await render(<OrderRecommendationSection surface="map" />)

    expect(screen.getByTestId('order-recommendation-map-control')).toHaveStyle({
      top: 10,
      left: 64,
      right: 64,
    })
    expect(screen.getByText('Подробнее')).toBeTruthy()
    expect(screen.getByTestId('order-recommendation-route-hide')).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByTestId('order-recommendation-map-button'))
    })

    expect(screen.getByText('Подробнее')).toBeTruthy()
    expect(screen.getByTestId('order-recommendation-sheet')).toBeTruthy()
    expect(screen.getByText('Рекомендации по заказам')).toBeTruthy()
    expect(useOrderRecommendationStore.getState().isRouteVisible).toBe(true)
    expect(mockRequestRecommendation).not.toHaveBeenCalled()
  })

  it('показывает нижнюю модалку, когда подходящих заказов нет', async () => {
    mockRequestRecommendation.mockResolvedValue({
      st: false,
      code: 'no_suitable_orders',
      text: 'Подходящих заказов для Вас сейчас нет.',
    })
    const screen = await render(<OrderRecommendationSection />)

    await act(async () => {
      fireEvent.press(screen.getByTestId('order-recommendation-button'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('order-recommendation-empty-sheet')).toBeTruthy()
    })
    expect(screen.getByText('Подходящих заказов для Вас сейчас нет.')).toBeTruthy()
    expect(screen.getByText('Помочь с выбором')).toBeTruthy()
    expect(useOrderRecommendationStore.getState().isRouteVisible).toBe(false)
  })

  it('не показывает запоздавший результат после начала взятия заказа', async () => {
    let resolveRecommendation!: (value: any) => void
    mockRequestRecommendation.mockReturnValue(
      new Promise(resolve => {
        resolveRecommendation = resolve
      }),
    )
    const screen = await render(<OrderRecommendationSection />)

    await act(async () => {
      fireEvent.press(screen.getByTestId('order-recommendation-button'))
    })
    await waitFor(() => {
      expect(useOrderRecommendationStore.getState().isLoading).toBe(true)
    })

    await act(async () => {
      emitOrderTakeStarted(order.id)
    })

    expect(useOrderRecommendationStore.getState().isLoading).toBe(false)
    expect(screen.getByText('Помочь с выбором')).toBeTruthy()

    await act(async () => {
      resolveRecommendation({
        st: true,
        title: 'Устаревший совет',
        take: [{id: order.id, seq: 1, reason: 'Уже неактуально'}],
      })
    })

    await waitFor(() => {
      expect(useOrderRecommendationStore.getState().result).toBeNull()
      expect(useOrderRecommendationStore.getState().isRouteVisible).toBe(false)
    })
  })
})
