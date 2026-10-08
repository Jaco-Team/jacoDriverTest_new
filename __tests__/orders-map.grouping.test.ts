// __tests__/orders-map.grouping.test.ts
/**
 * showOrdersMap:
 * - открывает карту и кладёт в showOrders все заказы с теми же координатами
 * - если заказа с таким id нет (или orders пуст), карта не открывается
 */

// глушим аналитику (OrderMapOpen/Close)
jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: jest.fn() },
  AnalyticsEvent: {},
}));

describe('showOrdersMap: группировка и пустые списки', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('группирует по координатам независимо от адреса и подъезда', () => {
    const { useOrdersStore } = require('@/shared/store/store');

    // наполняем стораж
    useOrdersStore.setState({
      orders: [
        {
          id: 10,
          addr: 'ул. Ленина, 1',
          pd: '1',
          xy: {lat: 53.5321, lon: 49.3214},
        },
        {
          id: 11,
          addr: 'другое написание адреса',
          pd: '2',
          xy: {lat: 53.532101, lon: 49.321401},
        },
        {
          id: 12,
          addr: 'ул. Ленина, 1',
          pd: '1',
          xy: {lat: 53.5322, lon: 49.3214},
        },
      ],
      isOpenOrderMap: false,
      showOrders: [],
    });

    // открываем карту по id=10
    useOrdersStore.getState().showOrdersMap(10);

    const s = useOrdersStore.getState();
    expect(s.isOpenOrderMap).toBe(true);
    const ids = s.showOrders.map((o: any) => o.id).sort();
    expect(ids).toEqual([10, 11]);
  });

  it('если id не найден / orders пуст — карта не открывается', () => {
    const { useOrdersStore } = require('@/shared/store/store');

    useOrdersStore.setState({
      orders: [],
      isOpenOrderMap: false,
      showOrders: [],
    });

    useOrdersStore.getState().showOrdersMap(999); // несуществующий
    const s = useOrdersStore.getState();
    expect(s.isOpenOrderMap).toBe(false);
    expect(s.showOrders).toEqual([]);
  });
});
