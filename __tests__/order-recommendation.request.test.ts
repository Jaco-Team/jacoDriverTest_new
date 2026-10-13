import type {Order} from '@/shared/store/OrdersStoreType'

import {buildOrderRecommendationRequest} from '@/features/order-recommendation/model/buildOrderRecommendationRequest'

describe('buildOrderRecommendationRequest', () => {
  it('по умолчанию использует часовой пояс Самары независимо от симулятора', () => {
    const payload = buildOrderRecommendationRequest({
      orders: [{id: 1}] as Order[],
      pointId: 1,
      limit: '',
      limitCount: '',
      courier: null,
      now: new Date('2026-10-09T14:13:00.000Z'),
    })

    expect(payload.now).toBe('2026-10-09T14:13:00.000Z')
    expect(payload.timezone).toBe('Europe/Samara')
  })

  it('отправляет маршрутные данные без персональных данных клиента и водителя', () => {
    const order = {
      id: 18452,
      id_text: 'Заказ 18452',
      addr: 'Секретный адрес',
      number: '+79990000000',
      comment: 'Позвонить клиенту',
      pd: '2',
      et: '5',
      kv: '18',
      driver_name: 'Иван',
      driver_login: '79991112233',
      drink_list: [{name: 'Напиток клиента'}],
      status_order: 2,
      is_pred: 0,
      is_my: 1,
      time_start_order: '10:25',
      need_time: '11:00',
      to_time: '45 мин',
      sum_order: 2450.5,
      count_pizza: 2,
      count_pasta: 0,
      count_other: 1,
      count_drink: 1,
      online_pay: 1,
      xy: {latitude: 53.53, longitude: 49.31},
    } as Order

    const payload = buildOrderRecommendationRequest({
      orders: [order],
      pointId: 12,
      limit: '2 400 / 15 000 ₽',
      limitCount: '1 / 5',
      courier: {lat: 53.52, lon: 49.3},
      now: new Date('2026-10-09T12:15:00.000Z'),
      timezone: 'Europe/Samara',
    })
    const serialized = JSON.stringify(payload)

    expect(payload).toMatchObject({
      now: '2026-10-09T12:15:00.000Z',
      timezone: 'Europe/Samara',
      point_id: 12,
      courier: {lat: 53.52, lon: 49.3},
      limits: {
        sum: {current: 2400, max: 15000},
        count: {current: 1, max: 5},
      },
    })
    expect(payload.orders[0]).toEqual({
      id: 18452,
      status: 2,
      is_preorder: false,
      is_mine: true,
      ready_at: '10:25',
      deliver_by: '11:00',
      remaining_time: '45 мин',
      amount: 2450.5,
      volume: {pizza: 2, pasta: 0, rolls: 1, drinks: 1},
      payment: 'online',
      xy: {lat: 53.53, lon: 49.31},
    })
    expect(serialized).not.toContain('Секретный адрес')
    expect(serialized).not.toContain('+79990000000')
    expect(serialized).not.toContain('Позвонить клиенту')
    expect(serialized).not.toContain('Напиток клиента')
    expect(serialized).not.toContain('Иван')
    expect(serialized).not.toContain('79991112233')
  })

  it('отбрасывает некорректные координаты и значения вне контракта Laravel', () => {
    const orders = [
      {id: 1, status_order: 9, online_pay: null, xy: {latitude: 0, longitude: 0}},
      {id: 2, status_order: 2, online_pay: 0, xy: {latitude: 91, longitude: 181}},
    ] as Order[]

    const payload = buildOrderRecommendationRequest({
      orders,
      pointId: 0,
      limit: '',
      limitCount: '',
      courier: {lat: 0, lon: 0},
      now: new Date('2026-10-09T12:15:00.000Z'),
      timezone: 'Europe/Samara',
    })

    expect(payload.point_id).toBeNull()
    expect(payload.courier).toBeNull()
    expect(payload.orders[0]).toMatchObject({status: null, payment: null, xy: null})
    expect(payload.orders[1]).toMatchObject({status: 2, payment: 'cash', xy: null})
  })
})
