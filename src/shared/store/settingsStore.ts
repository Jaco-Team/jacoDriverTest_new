import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {api} from './api';
import {isAppOffline} from '@/shared/lib/connectivityState';
import {normalizeGlobalFontSize} from '@/shared/lib/fontSize';
import {Theme} from '@/shared/types/globalTypes';
import {
  migrateAppThemeFromNightMap,
  useAppThemeStore,
  type AppThemePreference,
} from '@/shared/theme/AppThemeProvider';
import {
  MySettingsResponse,
  SettingsStore,
  SaveSettingsResponse,
  getPhoneCafeResponse,
} from './SettingsStoreType';
import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';
import {persistDriverOfflineState} from './driverOfflineState';
import {useGlobalStore} from './globalStore';
import {useLoginStore} from './loginStore';
import {useOrdersStore} from './ordersStore';
import {useStatStore} from './statStore';
import {
  SELECTED_POINT_STORAGE_KEY,
  bumpSettingsRevision,
  getSettingsRevision,
} from './storeShared';

let menuFlagsRequestId = 0;

function isEnabledFlag(value: unknown): boolean {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    (typeof value === 'string' && value.trim().toLowerCase() === 'true')
  );
}

function hasFlagValue(value: unknown): boolean {
  return value !== undefined && value !== null && `${value}`.trim() !== '';
}

// Как на сайте: если флага нет в ответе, текущее состояние меню не меняется.
function applyMenuFlags(settings?: {
  driver_avg_time?: unknown;
  driver_page_stat_time?: unknown;
}): void {
  const globalState = useGlobalStore.getState();

  if (hasFlagValue(settings?.driver_avg_time)) {
    globalState.setNeedAvgTime(isEnabledFlag(settings?.driver_avg_time));
  }
  if (hasFlagValue(settings?.driver_page_stat_time)) {
    globalState.setNeedPageStat(isEnabledFlag(settings?.driver_page_stat_time));
  }
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
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

  // установка поворота карты
  setRotateMap: is_rotate => {
    Analytics.log(
      is_rotate ? AnalyticsEvent.MapRotateOn : AnalyticsEvent.MapRotateOff,
      is_rotate
        ? 'Включение авто-ротация карты'
        : 'Выключение авто-ротация карты',
    );

    set({
      rotate_map: is_rotate,
    });
    void persistDriverOfflineState().catch(() => undefined);
  },

  setPointId: pointId => {
    const previousPointId = get().point_id;
    set({point_id: pointId});
    if (pointId === null) {
      void AsyncStorage.removeItem(SELECTED_POINT_STORAGE_KEY);
    } else {
      void AsyncStorage.setItem(SELECTED_POINT_STORAGE_KEY, String(pointId));
    }
    void persistDriverOfflineState().catch(() => undefined);
    void get().getPhoneCafe();
    void useStatStore.getState().getAvgTime();
    if (previousPointId !== pointId) {
      useOrdersStore.getState().switchPoint(pointId);
      // Среднее время и «Статистика» в меню включаются настройками кафе.
      void get().refreshMenuFlags(pointId);
    }
  },

  // При смене кафе обновляем только флаги меню; ответ на прошлый выбор игнорируется.
  refreshMenuFlags: async pointId => {
    const requestId = ++menuFlagsRequestId;
    if (isAppOffline()) return;

    const res = await api<MySettingsResponse>('settings', {
      type: 'getMySetting',
      ...(pointId ? {point_id: pointId} : {}),
    });

    if (res.st === false || requestId !== menuFlagsRequestId) return;

    applyMenuFlags(res.data);
    void persistDriverOfflineState().catch(() => undefined);
  },

  getSettings: async (silent = false) => {
    if (isAppOffline() || get().isClick) return;
    const requestRevision = getSettingsRevision();

    if (!silent) useGlobalStore.getState().setSpinner(true);

    const token = await useGlobalStore.getState().getAuthToken();

    const savedPointIdValue = await AsyncStorage.getItem(
      SELECTED_POINT_STORAGE_KEY,
    );
    // Пока читали хранилище, настройки могли сохранить или сбросить: устаревший
    // запрос уже не нужен.
    if (requestRevision !== getSettingsRevision() || useGlobalStore.getState().tokenAuth !== token) {
      if (!silent) useGlobalStore.getState().setSpinner(false);
      return;
    }
    const savedPointId = Number.parseInt(savedPointIdValue ?? '', 10);
    // Флаги меню — настройки кафе, поэтому сразу запрашиваем их для выбранного.
    const requestedPointId =
      get().point_id ?? (Number.isFinite(savedPointId) ? savedPointId : null);

    const data = {
      type: 'getMySetting',
      token: token,
      ...(requestedPointId ? {point_id: requestedPointId} : {}),
    };

    const res = await api<MySettingsResponse>('settings', data);

    if (res.st === false || requestRevision !== getSettingsRevision() || useGlobalStore.getState().tokenAuth !== token) {
      if (!silent) useGlobalStore.getState().setSpinner(false);
      return;
    }

    const points = res.data?.all_points ?? [];
    const previousPointId = get().point_id;
    const currentPointId =
      get().point_id ?? (Number.isFinite(savedPointId) ? savedPointId : null);
    const serverPointId = res.data?.point_id ?? null;
    const pointId =
      currentPointId && points.some(point => point.id === currentPointId)
        ? currentPointId
        : (serverPointId ?? points[0]?.id ?? null);
    // Сервер отдаёт флаги запрошенного кафе, а если оно недоступно — домашней точки.
    const flagsPointId =
      requestedPointId && points.some(point => point.id === requestedPointId)
        ? requestedPointId
        : serverPointId;

    set({points, point_id: pointId});
    get().getPhoneCafe();

    const fontSize = normalizeGlobalFontSize(res.data?.fontSize);

    useGlobalStore.getState().setFontSize(fontSize);
    useGlobalStore.getState().setTheme(res.data?.theme ?? 'white');
    //useGlobalStore.getState().setMapScale( parseFloat(res.data?.mapScale ?? 1) );
    useGlobalStore
      .getState()
      .setMapScale(parseFloat(String(res.data?.mapScale ?? 1)));

    if (pointId === flagsPointId) {
      applyMenuFlags(res.data);
    } else {
      // Кафе сменили, пока шёл запрос, или выбрано не то, для которого пришли флаги.
      void get().refreshMenuFlags(pointId);
    }
    useOrdersStore
      .getState()
      .setUpdateInterval(res.data?.update_interval ?? 30);

    set({
      action_centered_map: res.data?.action_centered_map,
      color: res.data?.color,
      fontSize,
      //mapScale: parseFloat(res.data?.mapScale ?? 1),
      mapScale: res.data?.mapScale,
      theme: res.data?.theme,
      type_data_map: res.data?.type_data_map,
      type_show_del: res.data?.type_show_del,
      update_interval: res.data?.update_interval,

      night_map: res.data?.night_map,
      app_theme: res.data?.app_theme,
      is_scaleMap: res.data?.is_scaleMap,
      map_hints: res.data?.map_hints ?? 1,
      ai_recommend: res.data?.ai_recommend ?? 0,
    });

    if (res.data?.app_theme) {
      await useAppThemeStore.getState().applyServerPreference(res.data.app_theme).catch(() => undefined);
    } else {
      await migrateAppThemeFromNightMap(res.data?.night_map).catch(() => undefined);
    }

    void persistDriverOfflineState().catch(() => undefined);

    if (previousPointId !== pointId) {
      useOrdersStore.getState().switchPoint(pointId);
    }

    if (!silent) {
      setTimeout(() => {
        useGlobalStore.getState().setSpinner(false);
      }, 300);
    }
  },

  // сохранение настроек
  saveSettings: async (
    type_show_del: string,
    centered_map: string[],
    fontSize: number,
    update_interval: number,
    color: string,
    mapScale: number,
    groupTypeTime: string,
    theme: Theme,
    night_map: string[],
    is_scaleMap: string[],
    app_theme: AppThemePreference | undefined = useAppThemeStore.getState().preference,
    map_hints = true,
    ai_recommend = false,
    successMessage = 'Настройки сохранены',
  ) => {
    if (isAppOffline()) return false;

    const normalizedFontSize = normalizeGlobalFontSize(fontSize);

    const token = await useGlobalStore.getState().getAuthToken();
    const owner = useLoginStore.getState().currentUser;
    const isCurrentSession = () => useGlobalStore.getState().tokenAuth === token &&
      useLoginStore.getState().currentUser?.user_id === owner?.user_id &&
      useLoginStore.getState().currentUser?.login === owner?.login;

    if (get().isClick === false) {
      set({isClick: true});
    } else {
      return false;
    }

    useGlobalStore.getState().setSpinner(true);

    const data = {
      type: 'saveMySetting',
      token: token,
      color,
      type_show_del,
      update_interval,
      type_data_map: groupTypeTime,
      action_centered_map: centered_map.length == 1 ? 1 : 0,
      night_map: night_map.length == 1 ? 1 : 0,
      dark_theme: night_map.length == 1 ? 1 : 0,
      app_theme,
      is_scaleMap: is_scaleMap.length == 1 ? 1 : 0,
      map_hints: map_hints ? 1 : 0,
      ai_recommend: ai_recommend ? 1 : 0,
      fontSize: normalizedFontSize,
      theme,
      mapScale,
    };

    try {
      const result = await api<SaveSettingsResponse>('settings', data);

      if (!isCurrentSession()) return false;

      if (result.st === false) {
        throw new Error(result.text || 'Не удалось сохранить настройки');
      }

      Analytics.log(
        AnalyticsEvent.SettingsSaveSuccess,
        'Успешное сохранение настроек',
      );

      bumpSettingsRevision();
      set({
        action_centered_map: data.action_centered_map,
        color,
        fontSize: normalizedFontSize,
        mapScale,
        theme,
        type_data_map: groupTypeTime as MySettingsResponse['type_data_map'],
        type_show_del: type_show_del as MySettingsResponse['type_show_del'],
        update_interval,
        night_map: data.night_map,
        app_theme: data.app_theme,
        is_scaleMap: data.is_scaleMap,
        map_hints: data.map_hints,
        ai_recommend: data.ai_recommend,
      });

      useGlobalStore.getState().showAlertText(true, successMessage);
      useGlobalStore.getState().setFontSize(normalizedFontSize);
      useGlobalStore.getState().setTheme(theme);
      useGlobalStore.getState().setMapScale(mapScale);
      useOrdersStore.getState().setUpdateInterval(update_interval);
      void useAppThemeStore.getState().setPreference(data.app_theme).catch(() => undefined);
      useAppThemeStore.getState().clearPreviewPreference();
      void persistDriverOfflineState().catch(() => undefined);
      return true;
    } catch (e) {
      if (!isCurrentSession()) return false;
      Analytics.log(
        AnalyticsEvent.SettingsSaveFail,
        'Ошибка в сохранение настроек',
      );
      useGlobalStore
        .getState()
        .showModalText(true, 'Не удалось сохранить настройки');
      return false;
    } finally {
      setTimeout(() => {
        if (!isCurrentSession()) return;
        set({isClick: false});
        useGlobalStore.getState().setSpinner(false);
      }, 300);
    }
  },

  getPhoneCafe: async () => {
    if (isAppOffline()) return;

    const token = await useGlobalStore.getState().getAuthToken();
    const pointId = get().point_id;

    const data = {
      token,
      type: 'get_point_phone',
      ...(pointId ? {point_id: pointId} : {}),
    };

    const json = await api<getPhoneCafeResponse>('settings', data);

    if (json.st === false) {
      useGlobalStore.getState().setSpinner(false);
      return;
    }

    if (get().point_id === pointId) {
      useGlobalStore.getState().setPhone(json.data?.phone ?? null);
      void persistDriverOfflineState().catch(() => undefined);
    }
  },
}));
