import AsyncStorage from '@react-native-async-storage/async-storage';
import {type LaravelAuthUser} from '@/shared/api/laravel/auth';
import {
  clearDriverOfflineCache,
  getDriverOfflineOwner,
  getDriverOfflineOwnerKey,
  isDriverOfflineOwnerMatch,
  readDriverOfflineCache,
  writeDriverOfflineCache,
  type DriverOfflineCache,
} from '@/shared/lib/driverOfflineCache';
import {normalizeGlobalFontSize} from '@/shared/lib/fontSize';
import {
  migrateAppThemeFromNightMap,
  useAppThemeStore,
} from '@/shared/theme/AppThemeProvider';
import {useGlobalStore} from './globalStore';
import {useLoginStore} from './loginStore';
import {getVisibleOrders, useOrdersStore} from './ordersStore';
import {useSettingsStore} from './settingsStore';
import {
  SELECTED_POINT_STORAGE_KEY,
  bumpSettingsRevision,
  getAllOrderStatusFilterIds,
} from './storeShared';

function isOrdersCacheKeyForOwner(cacheKey: string, ownerKey: string): boolean {
  try {
    const value: unknown = JSON.parse(cacheKey);
    return Array.isArray(value) && String(value[0]) === ownerKey;
  } catch {
    return false;
  }
}

function resetDriverOfflineState(): void {
  bumpSettingsRevision();
  useGlobalStore.setState({
    globalFontSize: 16,
    mapScale: 1,
    theme: 'white',
    phones: null,
    is_need_avg_time: false,
    is_need_page_stat: false,
  });

  useSettingsStore.setState({
    isClick: false,
    action_centered_map: 0,
    color: '',
    fontSize: 16,
    mapScale: 1,
    theme: 'white_border',
    type_data_map: 'norm',
    type_show_del: 'full',
    update_interval: 30,
    driver_avg_time: true,
    driver_page_stat_time: true,
    night_map: 0,
    app_theme: undefined,
    is_scaleMap: 0,
    map_hints: 1,
    ai_recommend: 0,
    rotate_map: false,
    points: [],
    point_id: null,
  });

  useOrdersStore.setState({
    type: {id: 1, text: 'Активные'},
    type_dop: getAllOrderStatusFilterIds(),
    is_showModalTypeDop: false,
    orders: [],
    ordersCache: {},
    ordersContextKey: '',
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
}

export async function clearDriverOfflineState(): Promise<void> {
  resetDriverOfflineState();
  await Promise.all([
    clearDriverOfflineCache().catch(() => undefined),
    AsyncStorage.removeItem(SELECTED_POINT_STORAGE_KEY).catch(() => undefined),
  ]);
}

export async function hydrateDriverOfflineState(cache: DriverOfflineCache): Promise<void> {
  const settings = cache.settings;
  const fontSize = normalizeGlobalFontSize(settings.fontSize);
  const ownerKey = getDriverOfflineOwnerKey(cache.owner);
  const ordersState = useOrdersStore.getState();
  const activeType =
    ordersState.types.find(item => item.id === cache.orders.activeTypeId) ??
    ordersState.types[0];
  const contextKey = JSON.stringify([
    ownerKey,
    settings.point_id,
    activeType.id,
  ]);
  const cachedOrders = cache.orders.ordersCache[contextKey] ?? [];
  const savedTypeDop = cache.orders.typeDop;
  // Only legacy caches treat the old three selected options as "all".
  // A new selection of those same three intentionally excludes assembly.
  const isLegacyAll = cache.orders.statusFilterVersion !== 2 &&
    savedTypeDop.length === 3 &&
    ['1', '2', '3'].every(id => savedTypeDop.includes(id));
  const restoredTypeDop = savedTypeDop.length === 0 || isLegacyAll
    ? ordersState.types_dop.map(item => String(item.id))
    : savedTypeDop;

  useSettingsStore.setState({
    action_centered_map: settings.action_centered_map,
    color: settings.color,
    fontSize,
    mapScale: settings.mapScale,
    theme: settings.theme,
    type_data_map: settings.type_data_map,
    type_show_del: settings.type_show_del,
    update_interval: settings.update_interval,
    driver_avg_time: settings.driver_avg_time,
    driver_page_stat_time: settings.driver_page_stat_time,
    night_map: settings.night_map,
    app_theme: settings.app_theme,
    is_scaleMap: settings.is_scaleMap,
    map_hints: settings.map_hints ?? 1,
    ai_recommend: settings.ai_recommend ?? 0,
    rotate_map: settings.rotate_map,
    points: settings.points,
    point_id: settings.point_id,
  });

  useGlobalStore.setState({
    globalFontSize: fontSize,
    mapScale: settings.mapScale,
    theme: settings.theme,
    phones: cache.phones,
    is_need_avg_time: settings.driver_avg_time == 1,
    is_need_page_stat: settings.driver_page_stat_time == 1,
  });

  if (settings.app_theme) {
    await useAppThemeStore.getState().applyServerPreference(settings.app_theme).catch(() => undefined);
  } else {
    await migrateAppThemeFromNightMap(settings.night_map).catch(() => undefined);
  }

  useOrdersStore.setState({
    type: activeType,
    type_dop: restoredTypeDop,
    orders: getVisibleOrders(
      cachedOrders,
      activeType,
      restoredTypeDop,
      ordersState.types_dop,
      ordersState.typeToStatus,
    ),
    ordersCache: cache.orders.ordersCache,
    ordersContextKey: contextKey,
    limit_summ: cache.orders.limitSumm,
    limit_count: cache.orders.limitCount,
    update_interval: cache.orders.updateInterval,
    driver_need_gps: cache.orders.driverNeedGps,
    home: cache.orders.home,
    ordersPrefetchPaused: true,
    ordersWarmupKey: '',
    ordersRefreshPending: false,
  });
}

export async function restoreDriverOfflineStateForUser(
  user: LaravelAuthUser,
): Promise<void> {
  await useAppThemeStore.getState().hydrateForOwner(getDriverOfflineOwnerKey(getDriverOfflineOwner(user)));
  const cache = await readDriverOfflineCache();
  if (!cache) return;

  if (!isDriverOfflineOwnerMatch(cache.owner, user)) {
    await clearDriverOfflineState();
    return;
  }

  await hydrateDriverOfflineState(cache);
}

export async function applyDriverSessionUser(user: LaravelAuthUser): Promise<boolean> {
  const previousUser = useLoginStore.getState().currentUser;
  const accountChanged = previousUser != null &&
    !isDriverOfflineOwnerMatch(getDriverOfflineOwner(previousUser), user);

  if (accountChanged) {
    await clearDriverOfflineState();
  } else if (!previousUser) {
    // Cold-start hydration below may restore the same account's saved choice.
    useOrdersStore.setState({
      type_dop: getAllOrderStatusFilterIds(),
      is_showModalTypeDop: false,
    });
  }

  useLoginStore.setState({currentUser: user});
  return accountChanged;
}

export async function persistDriverOfflineState(): Promise<void> {
  const user = useLoginStore.getState().currentUser;
  if (!user) return;

  const owner = getDriverOfflineOwner(user);
  const ownerKey = getDriverOfflineOwnerKey(owner);
  const globalState = useGlobalStore.getState();
  const settings = useSettingsStore.getState();
  const orders = useOrdersStore.getState();
  const ordersCache = Object.fromEntries(
    Object.entries(orders.ordersCache).filter(([cacheKey]) =>
      isOrdersCacheKeyForOwner(cacheKey, ownerKey),
    ),
  );

  await writeDriverOfflineCache({
    version: 1,
    savedAt: Date.now(),
    owner,
    phones: globalState.phones,
    settings: {
      action_centered_map: settings.action_centered_map ?? 0,
      color: settings.color ?? '',
      fontSize: globalState.globalFontSize,
      mapScale: globalState.mapScale,
      theme: globalState.theme,
      type_data_map: settings.type_data_map ?? 'norm',
      type_show_del: settings.type_show_del ?? 'full',
      update_interval: settings.update_interval ?? 30,
      driver_avg_time: globalState.is_need_avg_time,
      driver_page_stat_time: globalState.is_need_page_stat,
      night_map: settings.night_map ?? 0,
      app_theme: settings.app_theme,
      is_scaleMap: settings.is_scaleMap ?? 0,
      map_hints: settings.map_hints ?? 1,
      ai_recommend: settings.ai_recommend ?? 0,
      point_id: settings.point_id ?? null,
      all_points: settings.points ?? [],
      points: settings.points ?? [],
      rotate_map: settings.rotate_map ?? false,
    },
    orders: {
      activeTypeId: orders.type.id,
      driverNeedGps: orders.driver_need_gps,
      home: orders.home,
      limitCount: orders.limit_count,
      limitSumm: orders.limit_summ,
      ordersCache,
      typeDop: orders.type_dop,
      statusFilterVersion: 2,
      updateInterval: orders.update_interval,
    },
  });
}
