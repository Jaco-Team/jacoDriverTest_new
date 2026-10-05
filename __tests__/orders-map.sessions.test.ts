jest.mock('@/analytics/AppMetricaService', () => ({Analytics: {log: jest.fn()}, AnalyticsEvent: {}}));
import {useOrdersStore} from '@/shared/store/store';

beforeEach(() => {
  useOrdersStore.setState({isOpenOrderMap: false, mapOrderSession: 0, isClick: false, is_load: false, showOrders: [], orders: [{id: 1, addr: 'A', pd: '1'}, {id: 2, addr: 'B', pd: '1'}] as any});
});

it('старое завершение закрытия не закрывает повторно открытую карточку того же заказа', () => {
  const api = useOrdersStore.getState();
  api.showOrdersMap(1);
  const oldSession = useOrdersStore.getState().mapOrderSession;
  api.showOrdersMap(-1, oldSession);
  api.showOrdersMap(1);
  api.showOrdersMap(-1, oldSession);
  expect(useOrdersStore.getState().isOpenOrderMap).toBe(true);
  api.showOrdersMap(-1, useOrdersStore.getState().mapOrderSession);
  expect(useOrdersStore.getState().isOpenOrderMap).toBe(false);
});

it('защищает другой заказ от callbacks предыдущей карточки', () => {
  const api = useOrdersStore.getState(); api.showOrdersMap(1);
  const oldSession = useOrdersStore.getState().mapOrderSession;
  api.showOrdersMap(2); api.showOrdersMap(-1, oldSession);
  expect(useOrdersStore.getState().showOrders[0].id).toBe(2);
  expect(useOrdersStore.getState().isOpenOrderMap).toBe(true);
});

it('повторные нажатия открытой метки не пересоздают сессию', () => {
  const api = useOrdersStore.getState(); api.showOrdersMap(1);
  const session = useOrdersStore.getState().mapOrderSession;
  for (let i = 0; i < 50; ++i) api.showOrdersMap(1);
  expect(useOrdersStore.getState().mapOrderSession).toBe(session);
});

it('100 циклов открытия/закрытия не оставляют карту заблокированной', () => {
  const api = useOrdersStore.getState();
  for (let i = 0; i < 100; ++i) {
    api.showOrdersMap(i % 2 + 1);
    expect(useOrdersStore.getState().isOpenOrderMap).toBe(true);
    api.showOrdersMap(-1, useOrdersStore.getState().mapOrderSession);
    expect(useOrdersStore.getState().isOpenOrderMap).toBe(false);
  }
  api.showOrdersMap(1);
  expect(useOrdersStore.getState().isOpenOrderMap).toBe(true);
});

it.each(['isClick', 'is_load'] as const)('старый callback не обходит текущую блокировку %s', flag => {
  const api = useOrdersStore.getState(); api.showOrdersMap(1);
  const session = useOrdersStore.getState().mapOrderSession;
  useOrdersStore.setState({[flag]: true}); api.showOrdersMap(-1, session);
  expect(useOrdersStore.getState().isOpenOrderMap).toBe(true);
  useOrdersStore.setState({[flag]: false}); api.showOrdersMap(-1, session);
  expect(useOrdersStore.getState().isOpenOrderMap).toBe(false);
});


it('сохраняет принудительное закрытие после успешного действия с заказом', () => {
  const api = useOrdersStore.getState(); api.showOrdersMap(1);
  useOrdersStore.setState({isClick: true});
  api.showOrdersMap(-1);
  expect(useOrdersStore.getState().isOpenOrderMap).toBe(false);
});
