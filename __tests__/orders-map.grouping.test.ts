// __tests__/orders-map.grouping.test.ts
/**
 * showOrdersMap:
 * - открывает карту и кладёт в showOrders все заказы с тем же (addr, pd), что и выбранный
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

  it('группирует по (addr, pd) и открывает карту', () => {
    const { useOrdersStore } = require('@/shared/store/store');

    // наполняем стораж
    useOrdersStore.setState({
      orders: [
        { id: 10, addr: 'ул. Ленина, 1', pd: '2' },
        { id: 11, addr: 'ул. Ленина, 1', pd: '2' }, // та же группа
        { id: 12, addr: 'ул. Ленина, 2', pd: '2' }, // другой адрес
        { id: 13, addr: 'ул. Ленина, 1', pd: '3' }, // другой подъезд
      ],
      isOpenOrderMap: false,
      showOrders: [],
    });

    // открываем карту по id=10
    useOrdersStore.getState().showOrdersMap(10);

    const s = useOrdersStore.getState();
    expect(s.isOpenOrderMap).toBe(true);
    const ids = s.showOrders.map((o: any) => o.id).sort();
    expect(ids).toEqual([10, 11]); // только та же (addr, pd)
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
