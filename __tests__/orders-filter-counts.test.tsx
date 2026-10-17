import { renderHook } from '@testing-library/react-native'

let mockOrdersState: any
let mockUser: any
let mockPointId: number | null

jest.mock('@/shared/store/store', () => ({
  useGlobalStore: (selector: any) => selector({ globalFontSize: 16 }),
  useLoginStore: (selector: any) => selector({ currentUser: mockUser }),
  useSettingsStore: (selector: any) => selector({ point_id: mockPointId }),
  useOrdersStore: (selector: any) => selector(mockOrdersState),
}))

jest.mock('@/shared/lib/useDialCall', () => ({ useDialCall: jest.fn() }))

import { useModalFilterOrdersLogic } from '@/features/orders-map/model/useModalOrderLogic'

describe('счётчики фильтра заказов', () => {
  beforeEach(() => {
    mockUser = { user_id: 10 }
    mockPointId = 4
    mockOrdersState = {
      types_dop: [
        { id: 1, text: 'В очереди' },
        { id: 2, text: 'Готовится' },
        { id: 4, text: 'На сборке' },
        { id: 3, text: 'Собран' },
      ],
      typeToStatus: { '1': 'В очереди', '2': 'Готовится', '3': 'Собран', '4': 'Готов на кухне' },
      type_dop: ['3'],
      orders: [{ status: 'Собран' }],
      ordersCache: {
        '["10",4,1]': [
          { status: 'В очереди' },
          { status: 'Готовится' },
          { status: 'Готовится' },
          { status: 'Собран' },
          { status: 'Готов на кухне' },
          { status: 'Готов на кухне' },
          { status: 'В пути' },
        ],
        '["10",4,2]': [{ status: 'Собран' }],
        '["10",5,1]': [{ status: 'Собран' }],
        '["11",4,1]': [{ status: 'Собран' }],
      },
    }
  })

  it('считает raw Active текущего пользователя и кафе, независимо от выбранных статусов', async () => {
    const { result } = await renderHook(() => useModalFilterOrdersLogic())

    expect(result.current.statusCounts).toEqual({ '1': 1, '2': 2, '3': 1, '4': 2 })
  })

  it('при смене кафе не показывает счётчики предыдущего кафе', async () => {
    mockPointId = 5
    const { result } = await renderHook(() => useModalFilterOrdersLogic())

    expect(result.current.statusCounts).toEqual({ '1': 0, '2': 0, '3': 1, '4': 0 })
  })

  it('при отсутствии кеша показывает нули', async () => {
    mockUser = { user_id: 12 }
    const { result } = await renderHook(() => useModalFilterOrdersLogic())

    expect(result.current.statusCounts).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0 })
  })
})
