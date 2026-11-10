import {create} from 'zustand';
import {api} from './api';
import {isAppOffline} from '@/shared/lib/connectivityState';
import {OFFLINE_ORDER_ACTION_MESSAGE} from '@/shared/lib/offlineOrderAction';
import {getOrderMapLocationKey} from '@/shared/lib/orderMapLocation';
import {StatusTextType} from './LoginStoreType';
import {
  OrdersStore,
  GetOrdersResponse,
  Order,
  TypeOrder,
} from './OrdersStoreType';
import {
  emitOrderTakeStarted,
  emitSuccessfulOrderAction,
} from '@/shared/lib/orderActionEvents';
import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';
import {persistDriverOfflineState} from './driverOfflineState';
import {useGEOStore} from './geoStore';
import {useGlobalStore} from './globalStore';
import {useLoginStore} from './loginStore';
import {useSettingsStore} from './settingsStore';
import {
  ORDER_STATUS_FILTER_OPTIONS,
  getAllOrderStatusFilterIds,
} from './storeShared';

function getOrdersCacheScopeKey(
  pointId = useSettingsStore.getState().point_id ?? null,
): string {
  const currentUser = useLoginStore.getState().currentUser;
  const ownerId = currentUser?.user_id ?? currentUser?.login ?? 'session';

  return JSON.stringify([String(ownerId), pointId]);
}

function getOrdersCacheKey(
  typeId: number,
  pointId = useSettingsStore.getState().point_id ?? null,
): string {
  const currentUser = useLoginStore.getState().currentUser;
  const ownerId = currentUser?.user_id ?? currentUser?.login ?? 'session';

  return JSON.stringify([String(ownerId), pointId, typeId]);
}

const ORDER_ACTION_GEO_TIMEOUT_MS = 30000;
let orderActionSequence = 0;
let activeOrdersRequestContextKey = '';
let ordersRequestSequence = 0;
let latestOrdersRequestId = 0;
// Foreground and background requests share a revision for each cached section.
const latestOrdersRequestByContext = new Map<string, number>();

function getOrdersForCurrentScope(
  ordersCache: Record<string, Array<Order>>,
): Array<Order> {
  const scopeKey = getOrdersCacheScopeKey();
  const uniqueOrders = new Map<string, Order>();

  for (const [cacheKey, orders] of Object.entries(ordersCache)) {
    let entryScopeKey = '';

    try {
      const [ownerId, pointId] = JSON.parse(cacheKey) as [
        string,
        number | null,
        number,
      ];
      entryScopeKey = JSON.stringify([ownerId, pointId]);
    } catch {
      continue;
    }

    if (entryScopeKey !== scopeKey) continue;

    for (const order of orders) {
      const key = `${order.id}:${order.xy?.lat ?? order.xy?.latitude}:${order.xy?.lon ?? order.xy?.longitude}`;
      uniqueOrders.set(key, order);
    }
  }

  return [...uniqueOrders.values()];
}

export function getVisibleOrders(
  orders: Array<Order>,
  type: TypeOrder,
  typeDop: string[],
  typesDop: OrdersStore['types_dop'],
  typeToStatus: OrdersStore['typeToStatus'],
): Array<Order> {
  if (type.id !== 1 || typeDop.length === typesDop.length) {
    return orders;
  }

  const statuses = typeDop.map(item => typeToStatus[item]);
  return orders.filter(order => statuses.includes(order.status));
}

export const useOrdersStore = create<OrdersStore>()((set, get) => ({
  isClick: false,
  is_load: false,
  is_check: false,
  is_loadToken: false,

  type: {id: 1, text: 'Активные'},

  types: [
    {id: 1, text: 'Активные'}, //готовятся и готовы
    {id: 3, text: 'Предзаказы'}, //более часа
    {id: 2, text: 'Мои отмеченные'}, //мои
    {id: 5, text: 'У других курьеров'},
    {id: 6, text: 'Мои завершенные'}, //мои завершенеы
  ],

  types_dop: ORDER_STATUS_FILTER_OPTIONS,
  typeToStatus: {
    '1': 'В очереди',
    '2': 'Готовится',
    '3': 'Собран',
    '4': 'Готов на кухне',
  },

  type_dop: getAllOrderStatusFilterIds(),
  is_showModalTypeDop: false,

  limit_summ: '',
  limit_count: '',

  orders: [],
  del_orders: [],
  isHidingDelOrders: false,
  ordersCache: {},
  ordersContextKey: '',
  is_prefetching: false,
  ordersPrefetchPaused: false,
  ordersWarmupKey: '',
  ordersPrefetchCursor: 0,
  ordersRefreshPending: false,
  home: null,
  mapHomeCenterRequestId: 0,

  update_interval: 30,
  driver_need_gps: true,

  type_confirm: '',
  order_confirm_id: 0,
  is_modalConfirm: false,
  order_confirm_is_delete: false,

  showOrders: [],
  isOpenOrderMap: false,
  mapOrderSession: 0,

  // показ модалки выбора доп. типов заказов
  showModalTypeDop: (is_show: boolean) => {
    Analytics.log(
      is_show
        ? AnalyticsEvent.OrdersTypeDopModalOpen
        : AnalyticsEvent.OrdersTypeDopModalClose,
      is_show
        ? 'Открытие модалки доп. типов заказов на карте'
        : 'Закрытие модалки доп. типов заказов на карте',
    );

    set({is_showModalTypeDop: is_show});
  },

  setTypeDop: (type: string[]) => {
    const state = get();
    if (type.length == 0) {
      type = state.types_dop.map(item => String(item.id));
    }

    const cacheKey = getOrdersCacheKey(state.type.id);
    const cachedOrders = state.ordersCache[cacheKey];
    set({
      type_dop: type,
      ...(cachedOrders
        ? {
            orders: getVisibleOrders(
              cachedOrders,
              state.type,
              type,
              state.types_dop,
              state.typeToStatus,
            ),
          }
        : {}),
    });

    void persistDriverOfflineState().catch(() => undefined);
  },

  filterOrdersByTypes: <T extends {status: string}>(
    orders: T[],
    types: string[],
  ): T[] => {
    const typeToStatus = get().typeToStatus;

    // Получаем массив статусов, по которым нужно фильтровать
    const statuses = types.map(type => typeToStatus[type]);
    return orders.filter(order => statuses.includes(order.status));
  },

  // получение заказов
  getOrders: async (is_reload = false) => {
    const type_dop = get().type_dop;
    const types_dop = get().types_dop;
    const type = get().type;
    const selectedPointId = useSettingsStore.getState().point_id;
    const cacheKey = getOrdersCacheKey(type.id, selectedPointId);
    const cachedOrders = get().ordersCache[cacheKey];

    if (get().ordersContextKey !== cacheKey) {
      set({
        orders: cachedOrders
          ? getVisibleOrders(
              cachedOrders,
              type,
              type_dop,
              types_dop,
              get().typeToStatus,
            )
          : [],
        ordersContextKey: cacheKey,
      });
    }

    if (isAppOffline()) return;

    const token = await useGlobalStore.getState().getAuthToken();

    if (!token || token.length == 0) {
      return;
    }

    if (get().is_check && activeOrdersRequestContextKey === cacheKey) {
      set({ordersRefreshPending: true});
      return;
    }

    const requestId = ++ordersRequestSequence;
    latestOrdersRequestId = requestId;
    latestOrdersRequestByContext.set(cacheKey, requestId);
    activeOrdersRequestContextKey = cacheKey;
    set({
      is_check: true,
      ordersRefreshPending: false,
    });

    const finishRequest = () => {
      setTimeout(() => {
        if (requestId !== latestOrdersRequestId) return;

        const shouldRefreshCurrent = get().ordersRefreshPending;
        activeOrdersRequestContextKey = '';
        set({
          is_check: false,
          ordersRefreshPending: false,
        });

        useGlobalStore.getState().setSpinner(false);
        useGlobalStore.getState().setSpinnerHidden(false);
        if (shouldRefreshCurrent) {
          void get().getOrders(false);
        }
      }, 300);
    };

    const isLatestCurrentRequest = () =>
      requestId === latestOrdersRequestId &&
      getOrdersCacheKey(get().type.id) === cacheKey;
    const hasCachedResult = () =>
      Object.prototype.hasOwnProperty.call(get().ordersCache, cacheKey);

    if (is_reload) {
      useGlobalStore.getState().setSpinner(true);
    } else {
      useGlobalStore.getState().setSpinnerHidden(true);
    }

    const data = {
      type: 'get_orders',
      type_orders: type.id,
      token: token,
      ...(selectedPointId ? {point_id: selectedPointId} : {}),
    };

    try {
      const json = await api<GetOrdersResponse>('orders', data);

      if (latestOrdersRequestByContext.get(cacheKey) !== requestId) {
        finishRequest();
        return;
      }

      if (json.st === false) {
        Analytics.log(
          AnalyticsEvent.OrdersFetchFail,
          'Ошибка при получении списка заказов',
        );

        if (isLatestCurrentRequest()) {
          set({
            ordersPrefetchPaused: true,
            ordersWarmupKey: '',
          });
          if (!hasCachedResult() && get().orders.length === 0) {
            useGlobalStore
              .getState()
              .showModalText(true, json.text || 'Не удалось загрузить заказы.');
          }
        }
        finishRequest();
        return;
      }

      if (json.data?.orders) {
        const responseOrders = json.data.orders;
        const currentState = get();
        const orders = getVisibleOrders(
          responseOrders,
          currentState.type,
          currentState.type_dop,
          currentState.types_dop,
          currentState.typeToStatus,
        );
        const ordersCache = {
          ...get().ordersCache,
          [cacheKey]: responseOrders,
        };
        const isCurrentContext = getOrdersCacheKey(get().type.id) === cacheKey;

        const nextHome = json.data?.home;
        const prevHome = get().home;
        const homeUnchanged = !!(
          prevHome &&
          nextHome &&
          Number(prevHome.lat) === Number(nextHome.lat) &&
          Number(prevHome.lon) === Number(nextHome.lon)
        );

        const effectiveHome = homeUnchanged ? prevHome : (nextHome ?? prevHome);

        set({
          ordersCache,
          ...(isCurrentContext
            ? {
                orders,
                ordersContextKey: cacheKey,
                ordersPrefetchPaused: false,
                limit_summ: json.data?.limit,
                limit_count: json.data?.limit_count,
                update_interval: json.data?.update_interval,
                driver_need_gps: json.data?.driver_need_gps == 1 ? true : false,
                home: effectiveHome,
                del_orders: Array.isArray(json.data?.arr_del_list)
                  ? json.data.arr_del_list
                      .map(item => ({id: Number(item?.id), addr: String(item?.addr ?? '')}))
                      .filter(item => Number.isInteger(item.id) && item.id > 0)
                  : [],
                //driver_pay: json?.driver_pay,
              }
            : {}),
        });

        void persistDriverOfflineState().catch(() => undefined);
        if (isCurrentContext) {
          if (nextHome && !homeUnchanged) {
            get().requestMapHomeCenter(true);
          }
        }
      } else {
        Analytics.log(
          AnalyticsEvent.OrdersFetchFail,
          'Ошибка при получении списка заказов',
        );
        if (
          isLatestCurrentRequest() &&
          !hasCachedResult() &&
          get().orders.length === 0
        ) {
          useGlobalStore
            .getState()
            .showModalText(true, json.text || 'Не удалось загрузить заказы.');
        }
      }
    } catch (err) {
      console.log(err);
      Analytics.log(
        AnalyticsEvent.OrdersFetchFail,
        'Ошибка при получении списка заказов',
      );
      if (isLatestCurrentRequest()) {
        set({
          ordersPrefetchPaused: true,
          ordersWarmupKey: '',
        });
      }
    }

    finishRequest();
  },

  // Фоновое наполнение и обновление кэша остальных разделов заказов.
  prefetchOrders: async (warmAll = false) => {
    if (isAppOffline()) return;

    const state = get();
    if (state.is_check || state.is_prefetching || state.ordersPrefetchPaused)
      return;

    const token = await useGlobalStore.getState().getAuthToken();
    if (!token || token.length === 0) return;

    const pointId = useSettingsStore.getState().point_id;
    const scopeKey = getOrdersCacheScopeKey(pointId);
    const currentTypeId = get().type.id;
    const backgroundPriority = [1, 2, 5, 3, 6];
    const backgroundTypes = get()
      .types.filter(item => item.id !== currentTypeId)
      .sort(
        (left, right) =>
          backgroundPriority.indexOf(left.id) -
          backgroundPriority.indexOf(right.id),
      );
    if (backgroundTypes.length === 0) return;

    const needsWarmup = warmAll && get().ordersWarmupKey !== scopeKey;
    const cursor = get().ordersPrefetchCursor % backgroundTypes.length;
    const typesToLoad = needsWarmup
      ? backgroundTypes
      : [backgroundTypes[cursor]];
    let completed = true;

    set({is_prefetching: true});

    try {
      for (const backgroundType of typesToLoad) {
        const cacheKey = getOrdersCacheKey(backgroundType.id, pointId);
        const requestId = ++ordersRequestSequence;
        latestOrdersRequestByContext.set(cacheKey, requestId);
        const json = await api<GetOrdersResponse>('orders', {
          type: 'get_orders',
          type_orders: backgroundType.id,
          token,
          ...(pointId ? {point_id: pointId} : {}),
        });

        if (getOrdersCacheScopeKey() !== scopeKey) {
          completed = false;
          break;
        }

        if (latestOrdersRequestByContext.get(cacheKey) !== requestId) continue;

        if (json.st === false || !json.data?.orders) {
          completed = false;
          set({
            ordersPrefetchPaused: true,
            ordersWarmupKey: '',
          });
          break;
        }

        const responseOrders = json.data.orders;
        const ordersCache = {
          ...get().ordersCache,
          [cacheKey]: responseOrders,
        };
        const currentState = get();
        const isCurrentContext =
          getOrdersCacheKey(currentState.type.id) === cacheKey;
        const previousHome = currentState.home;
        const nextHome = json.data?.home;
        const homeUnchanged = !!(
          previousHome &&
          nextHome &&
          Number(previousHome.lat) === Number(nextHome.lat) &&
          Number(previousHome.lon) === Number(nextHome.lon)
        );

        set({
          ordersCache,
          ...(isCurrentContext
            ? {
                orders: getVisibleOrders(
                  responseOrders,
                  currentState.type,
                  currentState.type_dop,
                  currentState.types_dop,
                  currentState.typeToStatus,
                ),
                ordersContextKey: cacheKey,
                limit_summ: json.data?.limit,
                limit_count: json.data?.limit_count,
                update_interval: json.data?.update_interval,
                driver_need_gps: json.data?.driver_need_gps == 1 ? true : false,
                home: homeUnchanged ? previousHome : (nextHome ?? previousHome),
              }
            : {}),
        });

        if (isCurrentContext && nextHome && !homeUnchanged) {
          get().requestMapHomeCenter(true);
        }
      }

      if (completed && getOrdersCacheScopeKey() === scopeKey) {
        set({
          ordersWarmupKey: needsWarmup ? scopeKey : get().ordersWarmupKey,
          ordersPrefetchCursor: needsWarmup
            ? get().ordersPrefetchCursor
            : get().ordersPrefetchCursor + 1,
        });
      }
    } catch (err) {
      completed = false;
      if (getOrdersCacheScopeKey() === scopeKey) {
        set({
          ordersPrefetchPaused: true,
          ordersWarmupKey: '',
        });
      }
    } finally {
      set({
        is_prefetching: false,
      });

      if (completed && getOrdersCacheScopeKey() === scopeKey) {
        void persistDriverOfflineState().catch(() => undefined);
      }
    }
  },

  // выбор типа заказа
  selectType: (item: TypeOrder) => {
    Analytics.log(AnalyticsEvent.OrderSelect, 'Выбор типа заказа');

    const state = get();
    const cacheKey = getOrdersCacheKey(item.id);
    const cachedOrders = state.ordersCache[cacheKey];
    set({
      type: item,
      orders: cachedOrders
        ? getVisibleOrders(
            cachedOrders,
            item,
            state.type_dop,
            state.types_dop,
            state.typeToStatus,
          )
        : [],
      ordersContextKey: cacheKey,
    });
    void persistDriverOfflineState().catch(() => undefined);
    if (isAppOffline()) return Promise.resolve();

    return get().getOrders(false);
  },

  switchPoint: (pointId: number | null) => {
    const state = get();
    const typeDop = getAllOrderStatusFilterIds();
    const cacheKey = getOrdersCacheKey(state.type.id, pointId);
    const cachedOrders = state.ordersCache[cacheKey];

    set({
      type_dop: typeDop,
      is_showModalTypeDop: false,
      orders: cachedOrders
        ? getVisibleOrders(
            cachedOrders,
            state.type,
            typeDop,
            state.types_dop,
            state.typeToStatus,
          )
        : [],
      ordersContextKey: cacheKey,
      del_orders: [],
      limit_summ: '',
      limit_count: '',
      home: null,
      showOrders: [],
      isOpenOrderMap: false,
      ordersPrefetchPaused: false,
      ordersWarmupKey: '',
      ordersPrefetchCursor: 0,
      ordersRefreshPending: false,
    });

    void persistDriverOfflineState().catch(() => undefined);
    if (!isAppOffline()) {
      void get().getOrders(true);
    }
  },

  // интервал обновления заказов
  hideDelOrders: async () => {
    if (get().isHidingDelOrders || get().del_orders.length === 0) return;
    if (isAppOffline()) {
      useGlobalStore.getState().showModalText(true, OFFLINE_ORDER_ACTION_MESSAGE);
      return;
    }

    const ids = get().del_orders.map(item => item.id);
    set({isHidingDelOrders: true});
    try {
      const pointId = useSettingsStore.getState().point_id;
      const response = await api<StatusTextType>('orders', {
        type: 'hide_del_orders',
        id_list: ids,
        ...(pointId ? {point_id: pointId} : {}),
      });

      if (!response.st) {
        useGlobalStore.getState().showModalText(true, response.text || 'Не удалось скрыть удалённые заказы.');
        return;
      }

      set(state => ({del_orders: state.del_orders.filter(item => !ids.includes(item.id))}));
    } catch (error) {
      useGlobalStore.getState().showModalText(
        true,
        error instanceof Error ? error.message : 'Не удалось скрыть удалённые заказы.',
      );
    } finally {
      set({isHidingDelOrders: false});
    }
  },

  setUpdateInterval: (interval: number) => {
    set({update_interval: interval});
  },

  // завершение/отмена/клиент не вышел на связь заказа при подтвреждении в модалке на страницах Список заказов / Заказы на карте
  actionButtonOrder: (type: number, order_id: number) => {
    if (get().isClick) {
      return;
    }

    if (isAppOffline()) {
      if (get().is_modalConfirm) get().setActiveConfirm(false);
      useGlobalStore.getState().showModalText(true, OFFLINE_ORDER_ACTION_MESSAGE);
      return;
    }

    set({isClick: true});

    useGlobalStore.getState().setSpinner(true);

    const fromModal = get().is_modalConfirm === true;
    const isConfirmFake = fromModal && get().type_confirm === 'fake';

    // логируем только валидные случаи
    if (isConfirmFake) {
      Analytics.log(AnalyticsEvent.ConfirmApprove, 'Клиент не вышел на связь');
    } else if (type === 1) {
      Analytics.log(AnalyticsEvent.ConfirmApprove, 'Взятие заказа');
    } else if (type === 2) {
      Analytics.log(AnalyticsEvent.ConfirmApprove, 'Заказ отменен');
    } else if (type === 3) {
      Analytics.log(AnalyticsEvent.ConfirmApprove, 'Заказ завершен');
    }

    // isClick снимает finally запроса. Если запрос так и не стартовал
    // (геопозиция не получена), блокировку снимаем здесь, но только для
    // этого же нажатия, чтобы не разблокировать уже следующее действие.
    const actionId = ++orderActionSequence;
    let requestStarted = false;
    const releaseIfNotStarted = () => {
      if (!requestStarted && orderActionSequence === actionId) {
        set({isClick: false});
        // Полноэкранный спиннер иначе продолжал бы перекрывать приложение.
        useGlobalStore.getState().setSpinner(false);
      }
    };
    const startRequest = (cb: any) => (payload: any) => {
      requestStarted = true;
      return cb(payload);
    };

    const callWithGeo = (cb: any, payload: any) => {
      if (get().driver_need_gps) {
        useGEOStore.getState().check_pos(startRequest(cb), payload, true, releaseIfNotStarted, true);
      } else {
        useGEOStore.getState().check_pos_fake(startRequest(cb), payload);
      }
    };

    if (type === 1) {
      // "Взять" заказ:
      // если это НЕ из модалки "fake" — всегда обычный путь
      if (isConfirmFake) {
        // кейс "Клиент не вышел на связь" подтверждён в модалке
        callWithGeo(get().actionOrderFake, {order_id, type});
      } else {
        // обычное "Взять" — игнорируем залипший type_confirm
        emitOrderTakeStarted(order_id);
        useGEOStore
          .getState()
          .check_pos_fake(startRequest(get().actionOrder), {order_id, type});
      }
    } else {
      // type === 2/3 — отмена/завершение: нужна обычная гео-проверка
      callWithGeo(get().actionOrder, {order_id, type});
    }

    // Геолокация без ответа не должна навсегда блокировать кнопки заказа.
    setTimeout(releaseIfNotStarted, ORDER_ACTION_GEO_TIMEOUT_MS);
  },

  actionOrder: async ({
    data: {order_id, type},
    latitude = '',
    longitude = '',
  }) => {
    if (isAppOffline()) {
      useGlobalStore.getState().setSpinner(false);
      set({isClick: false});
      useGlobalStore.getState().showModalText(true, OFFLINE_ORDER_ACTION_MESSAGE);
      return;
    }

    //1 - get / 2 - close / 3 - finish
    const token = await useGlobalStore.getState().getAuthToken();
    useGlobalStore.getState().setSpinner(true); // включаем тут, выключим в finally

    try {
      const data = {
        type: 'actionOrder',
        token: token,
        id: order_id,
        type_action: type,
        appToken: useGlobalStore.getState().notifToken,
        latitude: latitude,
        longitude: longitude,
        ...(useSettingsStore.getState().point_id
          ? {point_id: useSettingsStore.getState().point_id}
          : {}),
      };

      const res = await api<StatusTextType>('orders', data);

      if (res?.st === false) {
        // Сервер вернул ошибку — показываем текст (спиннер погасим в finally)
        useGlobalStore.getState().showModalText(true, res.text);

        return;
      }

      // УСПЕХ: немедленно приводим UI в актуальное состояние — независимо от update_interval
      // закрываем карту только если она реально открыта (чтобы не сыпались лишние события/логирование)
      if (get().isOpenOrderMap) {
        get().showOrdersMap(-1); // свернуть/закрыть карту/модалку
      }
      // Демо-аккаунт сразу возвращает тот же заказ при обновлении списка.
      // Принудительно размонтируем старую нативную шторку и инвалидируем её
      // callbacks, даже если её isOpen уже успел измениться во время запроса.
      set({
        isOpenOrderMap: false,
        showOrders: [],
        mapOrderSession: get().mapOrderSession + 1,
      });

      if (type === 1 || type === 2) {
        get().requestMapHomeCenter();
      }

      emitSuccessfulOrderAction({
        orderId: order_id,
        type: type === 1 ? 'take' : type === 2 ? 'cancel' : 'finish',
      });

      get().getOrders(); // ручной рефреш списка

      // закрываем confirm только если он был открыт
      if (get().is_modalConfirm) {
        get().setActiveConfirm(false);
      }
    } finally {
      // Всегда гасим спиннер и снимаем «клик», даже при исключении
      useGlobalStore.getState().setSpinner(false);
      set({isClick: false});
    }
  },

  actionOrderFake: async ({
    data: {order_id},
    latitude = '',
    longitude = '',
    accuracy = 0,
  }) => {
    if (isAppOffline()) {
      useGlobalStore.getState().setSpinner(false);
      set({isClick: false});
      useGlobalStore.getState().showModalText(true, OFFLINE_ORDER_ACTION_MESSAGE);
      return;
    }

    const token = await useGlobalStore.getState().getAuthToken();
    useGlobalStore.getState().setSpinner(true); // включаем тут, выключим в finally

    try {
      const data = {
        type: 'checkFakeOrder',
        token: token,
        order_id: order_id,
        latitude: latitude,
        longitude: longitude,
        ...(useSettingsStore.getState().point_id
          ? {point_id: useSettingsStore.getState().point_id}
          : {}),
      };

      const res = await api<StatusTextType>('orders', data);

      if (res?.st === false) {
        useGlobalStore.getState().showModalText(true, res.text);

        return;
      }

      // УСПЕХ: вручную обновляем UI (раньше тут не было showOrdersMap(-1) — из-за этого «ничего не происходило» при отключённом автообновлении)
      // закрываем карту только если она реально открыта (чтобы не сыпались лишние события/логирование)
      if (get().isOpenOrderMap) {
        get().showOrdersMap(-1); // свернуть/закрыть карту/модалку
      }
      set({
        isOpenOrderMap: false,
        showOrders: [],
        mapOrderSession: get().mapOrderSession + 1,
      });

      get().getOrders();
    } finally {
      useGlobalStore.getState().setSpinner(false);
      set({isClick: false});
    }
  },

  // открытие/закрытие модалки с подтверждением завершения заказа
  setActiveConfirm: (
    active,
    order_id,
    type_confirm,
    order_confirm_is_delete,
  ) => {
    if (active && isAppOffline()) {
      useGlobalStore.getState().showModalText(true, OFFLINE_ORDER_ACTION_MESSAGE);
      return;
    }

    if (active) {
      Analytics.log(
        AnalyticsEvent.ConfirmModalOpen,
        'Открытие модалки подтверждения заказа',
      );
    } else {
      Analytics.log(
        AnalyticsEvent.ConfirmModalClose,
        'Закрытие модалки подтверждения заказа',
      );
    }

    set({
      //type_confirm,
      type_confirm: active ? type_confirm : '', // ← сбрасываем при закрытии, изменения после тестирования
      order_confirm_id: order_id,
      is_modalConfirm: active,
      order_confirm_is_delete,
    });
  },

  requestMapHomeCenter: (force = false) => {
    if (force || useSettingsStore.getState().action_centered_map == 1) {
      set({
        mapHomeCenterRequestId: get().mapHomeCenterRequestId + 1,
      });
    }
  },

  // открытие заказа на карте
  showOrdersMap: (id: number, expectedSession?: number) => {
    if (id === -1) {
      const current = get();
      if (expectedSession !== undefined && (current.isClick || current.is_load || current.mapOrderSession !== expectedSession)) return;
      // логируем закрытие ТОЛЬКО если реально было открыто
      if (get().isOpenOrderMap) {
        Analytics.log(AnalyticsEvent.OrderMapClose, 'Закрытие заказа на карте');
        set({
          isOpenOrderMap: false,
        });
      }

      return;
    }

    const order = get().orders.find(item => item.id === id);

    if (order) {
      if (get().isOpenOrderMap && get().showOrders.some(item => item.id === id)) return;
      const locationKey = getOrderMapLocationKey(order);
      const new_orders = locationKey
        ? get().orders.filter(
            item => getOrderMapLocationKey(item) === locationKey,
          )
        : [order];

      Analytics.log(AnalyticsEvent.OrderMapOpen, 'Открытие заказа на карте');

      set({
        showOrders: new_orders,
        isOpenOrderMap: true,
        mapOrderSession: get().mapOrderSession + 1,
      });
    }
  },
}));
