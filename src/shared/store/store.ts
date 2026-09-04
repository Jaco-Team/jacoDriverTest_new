import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation, {
  type GeolocationError,
  type GeolocationOptions,
  type GeolocationResponse,
} from '@react-native-community/geolocation';
import {request, PERMISSIONS, RESULTS, checkMultiple} from 'react-native-permissions';
import {Platform} from 'react-native';

import { api } from './api';
import {
  exchangeLaravelSsoLoginCode,
  fetchLaravelMe,
  loginWithLaravel,
  logoutFromLaravel,
} from '@/shared/api/laravel/auth';
import { getLaravelApiErrorInfo } from '@/shared/api/laravel/errors';
import {
  createLaravelFeedback,
  fetchLaravelFeedbacks,
} from '@/shared/api/laravel/feedback';
import {
  clearLaravelAuthToken,
  getLaravelAuthToken,
  saveLaravelAuthToken,
} from '@/shared/lib/laravelAuthTokenStorage';
import { Theme, ShowType } from '@/shared/types/globalTypes'
import { globalTypes } from './GlobalStoreType';
import { StatusTextType, LoginTypes, LoginResponse } from './LoginStoreType';
import { StatTypes, PriceResponse, GraphResponse, GraphErrCam, GraphErrOrder, AnswerErrCamResponse, StatResponse } from './StatStoreType';
import { MySettingsResponse, SettingsStore, SaveSettingsResponse, getPhoneCafeResponse, phoneType } from './SettingsStoreType';

import { OrdersStore, GetOrdersResponse, TypeOrder, actionOrderType } from './OrdersStoreType';
import { FeedbackStatus, FeedbackState } from './FeedbackStoreType'

import { GEOStore } from './GEOStoreType';

import dayjs, { ConfigType } from 'dayjs'
import 'dayjs/locale/ru'

dayjs.locale('ru')

import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';

interface ExtendedGeolocationResponse extends GeolocationResponse {
  mocked?: boolean;
}

const DRIVER_LOCATION_FIRST_TIMEOUT_MS = 15000
const DRIVER_LOCATION_RETRY_TIMEOUT_MS = 10000
const SELECTED_POINT_STORAGE_KEY = 'selected_driver_point_id'

function requestCurrentPosition(options: GeolocationOptions): Promise<ExtendedGeolocationResponse> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, options)
  })
}

function isLocationPermissionError(error: unknown): boolean {
  const locationError = error as Partial<GeolocationError> | null
  const message = String(locationError?.message ?? '').toLowerCase()

  return locationError?.code === 1 || message.includes('denied') || message.includes('permission')
}

function getDriverLocationErrorText(error: unknown): string {
  const locationError = error as Partial<GeolocationError> | null
  const message = String(locationError?.message ?? '').toLowerCase()

  if (isLocationPermissionError(error)) {
    return 'Нет доступа к геолокации. Разрешите доступ к местоположению в настройках телефона.'
  }

  if (locationError?.code === 3 || message.includes('timeout')) {
    return 'Местоположение определяется слишком долго. Проверьте GPS и интернет, затем повторите действие.'
  }

  return 'Не удалось определить местоположение. Включите GPS и выйдите на открытое место, затем повторите действие.'
}

export const useGlobalStore = create<globalTypes>()((set, get) => ({
  loadSpinner: false,
  loadSpinnerHidden: false,

  is_show_modal_text: false,
  is_show_alert_text: false,
  modal_text: '',

  tokenAuth: '',

  globalFontSize: 16,
  theme: 'white',
  mapScale: 1,
  phones: null,

  is_need_avg_time: true,
  is_need_page_stat: false,

  avgTime: '',

  notifToken: '',

  showModalText: ( is_open: boolean, text?: string ) => { set({is_show_modal_text: is_open, modal_text: text}) },
  showAlertText: ( is_open: boolean, text?: string ) => { 
    set({is_show_alert_text: is_open, modal_text: text});
    if( is_open === true ){
      setTimeout(() => set({ is_show_alert_text: false }), 5000);
    }
  },

  setSpinner: (status: boolean) => { set({loadSpinner: status}) },
  setSpinnerHidden: (status: boolean) => { set({loadSpinnerHidden: status}) },

  setTokenAuth: async (token: string) => {
    set({tokenAuth: token})
  },

  getTokenAuth: async (): Promise<string> => { 
    return (await getLaravelAuthToken()) ?? '';
  },

  getAuthToken: async (): Promise<string> => {
    if( get().tokenAuth === '' ){
      const token = await get().getTokenAuth();

      set({tokenAuth: token});

      return token;
    } 

    return get().tokenAuth ?? '';
  },

  setFontSize: (size: number) => { set({globalFontSize: size}) },
  setTheme: (theme: Theme) => { set({theme: theme}) },
  setMapScale: (size: number) => { set({mapScale: size}) },
  setPhone: (phones: phoneType | null) => { set({phones: phones}) },
  setNeedAvgTime: (st: boolean) => { set({is_need_avg_time: st}) },
  setNeedPageStat: (st: boolean) => { set({is_need_page_stat: st}) },
  setAvgTime: (time: string) => { set({avgTime: time}) },
  setNotifToken: (token: string) => { set({notifToken: token}) },
}))

export const useLoginStore = create<LoginTypes>()((set, get) => ({
    is_load: false,
    is_loadToken: false,
  
    authData: {isAuth: false, token: ''},
    currentUser: null,
  
    initialPage: '',
    loginErr: '',
  
    wallpaper_btn: false,
    formAuth: true,
  
    auth: async (login: string, pwd: string, captchaToken: string = ''): Promise<StatusTextType> => {
      if (!get().is_load) {
        set({is_load: true});
      } else {
        return { st: false, text: "Пожалуйста, подождите..." };
      }
      
      useGlobalStore.getState().setSpinner(true);
  
      let result: StatusTextType;

      try {
        const laravelSession = await loginWithLaravel(login, pwd, captchaToken);
        await saveLaravelAuthToken(laravelSession.token);
        await useGlobalStore.getState().setTokenAuth(laravelSession.token);
        const currentUser = await fetchLaravelMe(laravelSession.token);
        set({ currentUser });

        useSettingsStore.getState().getSettings();
        result = { st: true, text: '' };
      } catch (error) {
        await Promise.all([
          clearLaravelAuthToken().catch(() => undefined),
          useGlobalStore.getState().setTokenAuth('').catch(() => undefined),
        ]);
        set({ currentUser: null });

        const errorInfo = getLaravelApiErrorInfo(error);
        result = {
          st: false,
          text: errorInfo.message,
          captcha_required: errorInfo.captchaRequired,
        };
      }

      setTimeout( () => {
        set({is_load: false});
        useGlobalStore.getState().setSpinner(false);
      }, 500 )
      
      return result;
    },

    authWithSsoCode: async (loginCode: string): Promise<StatusTextType> => {
      if (get().is_load) {
        return { st: false, text: 'Пожалуйста, подождите...' };
      }

      set({is_load: true});
      useGlobalStore.getState().setSpinner(true);

      let result: StatusTextType;

      try {
        const laravelSession = await exchangeLaravelSsoLoginCode(loginCode);
        await saveLaravelAuthToken(laravelSession.token);
        await useGlobalStore.getState().setTokenAuth(laravelSession.token);
        const currentUser = await fetchLaravelMe(laravelSession.token);
        set({ currentUser });

        useSettingsStore.getState().getSettings();
        result = { st: true, text: '' };
      } catch (error) {
        await Promise.all([
          clearLaravelAuthToken().catch(() => undefined),
          useGlobalStore.getState().setTokenAuth('').catch(() => undefined),
        ]);
        set({ currentUser: null });

        result = {
          st: false,
          text: getLaravelApiErrorInfo(error).message,
        };
      }

      setTimeout(() => {
        set({is_load: false});
        useGlobalStore.getState().setSpinner(false);
      }, 500);

      return result;
    },

    sendSMS: async (login: string, pwd: string, captchaToken: string = ''): Promise<StatusTextType> => {
      if (!get().is_load) {
        set({is_load: true});
      } else {
        return { st: false, text: "Пожалуйста, подождите..." };
      }
  
      useGlobalStore.getState().setSpinner(true);

      const data = {
        type: 'get_sms',
        login,
        pwd,
        ...(captchaToken ? { captcha_token: captchaToken } : {}),
      };
  
      const json = await api<LoginResponse>('auth', data);

      if (json.st === true) {
        Analytics.log(AnalyticsEvent.AuthSendSms, 'Отправка СМС-кода');
      } else {
        Analytics.log(AnalyticsEvent.AuthSendSmsFail, 'Ошибка отправки СМС-кода');
      }

      setTimeout( () => {
        set({is_load: false});
        useGlobalStore.getState().setSpinner(false);
      }, 500 )
      
      return { st: json.st, text: json?.text ?? '' };
    },

    sendCode: async (login: string, code: string, pwd: string): Promise<StatusTextType> => {
      if (!get().is_load) {
        set({is_load: true});
      } else {
        return { st: false, text: "Пожалуйста, подождите..." };
      }
  
      useGlobalStore.getState().setSpinner(true);

      const data = {
        type: 'check_code',
        login,
        code,
      };
  
      const json = await api<LoginResponse>('auth', data);
  
      if (json.st === true) {
        try {
          const session = await loginWithLaravel(login, pwd);
          await saveLaravelAuthToken(session.token);
          await useGlobalStore.getState().setTokenAuth(session.token);
          const currentUser = await fetchLaravelMe(session.token);
          set({ currentUser });
          useSettingsStore.getState().getSettings();
        } catch (error) {
          await Promise.all([
            clearLaravelAuthToken().catch(() => undefined),
            useGlobalStore.getState().setTokenAuth('').catch(() => undefined),
          ]);
          set({ currentUser: null });
          const errorInfo = getLaravelApiErrorInfo(error);
          json.st = false;
          json.text = errorInfo.message;
        }
      }
  
      setTimeout( () => {
        set({is_load: false});
        useGlobalStore.getState().setSpinner(false);
      }, 500 )
  
      return { st: json.st, text: json?.text ?? '' };
    },

    check_token: async () => {
      let laravelToken = '';

      try {
        laravelToken = await getLaravelAuthToken();
      } catch {
        // Secure storage can be temporarily unavailable (for example, in an
        // unsigned iOS simulator build). Startup must still leave Greeting.
        await useGlobalStore.getState().setTokenAuth('').catch(() => undefined);
        useGlobalStore.getState().setSpinner(false);
        useGlobalStore.getState().setSpinnerHidden(false);
        set({ currentUser: null, is_load: false });
        return false;
      }

      if (!laravelToken) {
        await Promise.all([
          clearLaravelAuthToken().catch(() => undefined),
          useGlobalStore.getState().setTokenAuth('').catch(() => undefined),
        ]);
        useGlobalStore.getState().setSpinner(false);
        useGlobalStore.getState().setSpinnerHidden(false);
        set({ currentUser: null, is_load: false });
        return false;
      }

      try {
        const currentUser = await fetchLaravelMe(laravelToken);
        set({ currentUser });
      } catch (error) {
        if (getLaravelApiErrorInfo(error).status === 401) {
          await Promise.all([
            clearLaravelAuthToken(),
            useGlobalStore.getState().setTokenAuth(''),
          ]);
        }

        useGlobalStore.getState().setSpinner(false);
        useGlobalStore.getState().setSpinnerHidden(false);
        set({ currentUser: null, is_load: false });

        return false;
      }

      await useGlobalStore.getState().setTokenAuth(laravelToken);
      useSettingsStore.getState().getSettings();
      return true;
    },

    logogout: async () => {
      // метрика выхода
      Analytics.log(AnalyticsEvent.DrawerLogout, 'Выход из аккаунта');

      const laravelToken = await getLaravelAuthToken();

      await Promise.all([
        clearLaravelAuthToken(),
        useGlobalStore.getState().setTokenAuth(''),
      ]);
      set({ currentUser: null });

      if (laravelToken) {
        void logoutFromLaravel(laravelToken).catch(() => undefined);
      }
    },
}))

export const useStatStore = create<StatTypes>()((set, get) => ({
  isClick: false,

  dateGraph: '',

  statPrice: null,
  give_history: [],

  month_list: [],
  dates: [],
  users: [],
  user_name: '',
  err_cam: [],
  err_orders: [],

  statArr: [],

  isShowModalErrCam: false,
  modalErrCam: null,

  isShowModalErrOrder: false,
  modalErrOrder: null,

  FormatPrice: (price: number): string => {
    return new Intl.NumberFormat('ru-RU').format(price);
  },

  FormatDate: (date: ConfigType): string => {
    return dayjs(date).format("DD MMMM YYYY");
  },

  getStatPrice: async (date: string): Promise<void> => {
    useGlobalStore.getState().setSpinner(true);

    const token = await useGlobalStore.getState().getAuthToken();

    const data = {
      date,
      token,
      type: 'get_my_price',
      ...(useSettingsStore.getState().point_id ? { point_id: useSettingsStore.getState().point_id } : {}),
    };

    const response = await api<PriceResponse>('price', data);

    if( response.st === false ){
      useGlobalStore.getState().setSpinner(false);
      return ;
    }

    set({
      statPrice: response.data?.stat,
      give_history: response.data?.give_hist,
    });

    setTimeout( () => {
      useGlobalStore.getState().setSpinner(false);
    }, 500 )
  },

   getStatBetween: async (dateStart, dateEnd) => {
    useGlobalStore.getState().setSpinner(true);

    const token = await useGlobalStore.getState().getAuthToken();

    const data = {
      token: token,
      type: 'get_my_price_between',
      dateStart,
      dateEnd,
      ...(useSettingsStore.getState().point_id ? { point_id: useSettingsStore.getState().point_id } : {}),
    };

    const response = await api<PriceResponse>('price', data);

     if(response.st === false){
      useGlobalStore.getState().setSpinner(false);
      return ;
    }

    set({
      statPrice: response.data?.stat,
      give_history: response.data?.give_hist,
    });

    setTimeout( () => {
      useGlobalStore.getState().setSpinner(false);
    }, 500 )
  },

  setGraphDate: (date: string): void => {
    set({dateGraph: date})
  },

  getGraph: async (date?: string | null): Promise<void> => {
    useGlobalStore.getState().setSpinner(true);

    if( date ){
      set({
        dateGraph: date
      })
    }else{
      date = get().dateGraph
    }

    const token = await useGlobalStore.getState().getAuthToken();
    
    const data = {
      date,
      token,
      type: 'get_my_graph',
      ...(useSettingsStore.getState().point_id ? { point_id: useSettingsStore.getState().point_id } : {}),
    };

    const response = await api<GraphResponse>('graph', data);

    if( response.st === false ){
      useGlobalStore.getState().setSpinner(false);
      return ;
    }

    set({
      month_list: response?.data?.mounth,
      dates: response?.data?.all_dates,
      users: response?.data?.users,
      user_name: response?.data?.user_name,
      err_cam: response?.data?.errs.err_cam,
      err_orders: response?.data?.errs.orders,
    })

    setTimeout( () => {
      useGlobalStore.getState().setSpinner(false);
    }, 500 )
  },

  // показ модалки ошибки по камерам/заказам
  showModalErrCam(is_show: boolean, err?: GraphErrCam | null): void {
    Analytics.log(
      is_show ? AnalyticsEvent.GraphErrCamModalOpen : AnalyticsEvent.GraphErrCamModalClose,
      is_show ? 'Открытие модалки ошибки по камерам' : 'Закрытие модалки ошибки по камерам'
    );
    set({
      isShowModalErrCam: is_show,
      modalErrCam: err
    });
  },

  // показ модалки ошибки по заказам
  showModalErrOrder(is_show: boolean, err?: GraphErrOrder | null): void {
    Analytics.log(
      is_show ? AnalyticsEvent.GraphErrOrderModalOpen : AnalyticsEvent.GraphErrOrderModalClose,
      is_show ? 'Открытие модалки ошибки по заказу' : 'Закрытие модалки ошибки по заказу'
    );
    set({
      isShowModalErrOrder: is_show,
      modalErrOrder: err
    });
  },

  answer_err_cam: async (text: string, err_id: number) => {
    const token = await useGlobalStore.getState().getAuthToken();

    if (get().isClick === false) {
      set({isClick: true});
    } else {
      return;
    }

    useGlobalStore.getState().setSpinner(true);

    const data = {
      type: 'save_false_cash_cum',
      token: token,
      text: text,
      id: err_id,
    };

    const res = await api<AnswerErrCamResponse>('graph', data);

    if (res.st === false) {
      useGlobalStore.getState().showModalText(true, res?.text);
    } else {
      get().showModalErrCam(false);
      get().getGraph();
    }

    setTimeout(() => {
      set({isClick: false});
      useGlobalStore.getState().setSpinner(false);
    }, 300);
  },

  // ответ на ошибку/обжаловать ошибку по заказам
  answer_err_order: async (text: string, err_id: number, row_id: number) => {
    const token = await useGlobalStore.getState().getAuthToken();

    if (get().isClick === false) {
      set({isClick: true});
    } else {
      return;
    }

    const data = {
      type: 'save_false_cash_orders',
      token: token,
      text: text,
      err_id: err_id,
      row_id: row_id,
    };

    const res = await api<AnswerErrCamResponse>('graph', data);

    if (res?.st === false) {
      Analytics.log(AnalyticsEvent.GraphErrOrderAnswerFail, 'Обжалование (график работ): ошибка отправки');
      useGlobalStore.getState().showModalText(true, res?.text);
    } else {
      Analytics.log(AnalyticsEvent.GraphErrOrderAnswerSuccess, 'Обжалование (график работ): отправлено');
      get().showModalErrOrder(false);
      get().getGraph();
    }

    setTimeout(() => {
      set({isClick: false});
    }, 300);
  },

  getStatistics: async (date_start: string, date_end: string) => {
    const token = await useGlobalStore.getState().getAuthToken();

    useGlobalStore.getState().setSpinner(true);

    const data = {
      type: 'show_data',
      token,
      date_start,
      date_end,
      ...(useSettingsStore.getState().point_id ? { point_id: useSettingsStore.getState().point_id } : {}),
    };
  
    const json = await api<StatResponse>('stat_time', data);

    if( json.st === false ){
      useGlobalStore.getState().setSpinner(false);
      return ;
    }

    set({
      statArr: json?.data?.avg_orders
    })
   
    setTimeout(() => {
      useGlobalStore.getState().setSpinner(false);
    }, 300);
  },

  getAvgTime: async () => {
    const token = await useGlobalStore.getState().getAuthToken();

    if( token.length == 0 ){
      return;
    } 

    const data = {
      type: 'get_my_avg_time',
      token,
      ...(useSettingsStore.getState().point_id ? { point_id: useSettingsStore.getState().point_id } : {}),
    };

    const json = await api<string>('orders', data);

    if( json.st === false ){
      return ;
    }

    useGlobalStore.getState().setAvgTime( json.text );
  }
}))

export const useSettingsStore = create<SettingsStore>()( (set, get) => ({
  isClick: false,

  action_centered_map: 0,
  color: '',
  fontSize: 16,
  mapScale: 1,
  theme: 'white_border',
  type_data_map: "norm",
  type_show_del: "full",
  update_interval: 30,
  
  driver_avg_time: true,
  driver_page_stat_time: true,

  night_map: 0,
  is_scaleMap: 0,

  rotate_map: false,
  points: [],
  point_id: null,

  // установка поворота карты
  setRotateMap: (is_rotate) => {

    Analytics.log(
      is_rotate ? AnalyticsEvent.MapRotateOn : AnalyticsEvent.MapRotateOff,
      is_rotate ? 'Включение авто-ротация карты' : 'Выключение авто-ротация карты'
    );

    set({
      rotate_map: is_rotate,
    })
  },

  setPointId: (pointId) => {
    set({ point_id: pointId });
    if (pointId === null) {
      void AsyncStorage.removeItem(SELECTED_POINT_STORAGE_KEY);
    } else {
      void AsyncStorage.setItem(SELECTED_POINT_STORAGE_KEY, String(pointId));
    }
    void get().getPhoneCafe();
    void useStatStore.getState().getAvgTime();
    void useOrdersStore.getState().getOrders(true);
  },

  getSettings: async () => {
    useGlobalStore.getState().setSpinner(true);

    const token = await useGlobalStore.getState().getAuthToken();

    const data = {
      type: 'getMySetting',
      token: token,
    };

    const res = await api<MySettingsResponse>('settings', data);

    if( res.st === false ){
      useGlobalStore.getState().setSpinner(false);
      return ;
    }

    const points = res.data?.all_points ?? [];
    const savedPointIdValue = await AsyncStorage.getItem(SELECTED_POINT_STORAGE_KEY);
    const savedPointId = Number.parseInt(savedPointIdValue ?? '', 10);
    const currentPointId = get().point_id
      ?? (Number.isFinite(savedPointId) ? savedPointId : null);
    const serverPointId = res.data?.point_id ?? null;
    const pointId = currentPointId && points.some(point => point.id === currentPointId)
      ? currentPointId
      : (serverPointId ?? points[0]?.id ?? null);

    set({ points, point_id: pointId });
    get().getPhoneCafe();

    useGlobalStore.getState().setFontSize(parseInt(String(res.data?.fontSize ?? 16), 10));
    useGlobalStore.getState().setTheme(res.data?.theme ?? 'white');
    //useGlobalStore.getState().setMapScale( parseFloat(res.data?.mapScale ?? 1) );
    useGlobalStore.getState().setMapScale( parseFloat(String(res.data?.mapScale ?? 1)) );

    useGlobalStore.getState().setNeedAvgTime( (res.data?.driver_avg_time ?? 1) == 1 ? true : false );
    useGlobalStore.getState().setNeedPageStat( (res.data?.driver_page_stat_time ?? 0) == 1 ? true : false );
    useOrdersStore.getState().setUpdateInterval( res.data?.update_interval ?? 30 );

    set({
      action_centered_map: res.data?.action_centered_map,
      color: res.data?.color,
      fontSize: res.data?.fontSize,
      //mapScale: parseFloat(res.data?.mapScale ?? 1),
      mapScale: res.data?.mapScale,
      theme: res.data?.theme,
      type_data_map: res.data?.type_data_map,
      type_show_del: res.data?.type_show_del,
      update_interval: res.data?.update_interval,

      night_map: res.data?.night_map,
      is_scaleMap: res.data?.is_scaleMap
    })

    setTimeout( () => {
      useGlobalStore.getState().setSpinner(false);
    }, 300 )
  },

  // сохранение настроек
  saveSettings: async (type_show_del: string, centered_map: string[], fontSize: number, update_interval: number, color: string, mapScale: number, groupTypeTime: string, theme: Theme, night_map: string[], is_scaleMap: string[]) => {
    const token = await useGlobalStore.getState().getAuthToken();

    if (get().isClick === false) {
      set({isClick: true});
    } else {
      return;
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
      is_scaleMap: is_scaleMap.length == 1 ? 1 : 0,
      fontSize: fontSize,
      theme,
      mapScale
    };

    try {
      
      const result = await api<SaveSettingsResponse>('settings', data);

      if (result.st === false) {
        throw new Error(result.text || 'Не удалось сохранить настройки');
      }

      Analytics.log(AnalyticsEvent.SettingsSaveSuccess, 'Успешное сохранение настроек');

      set({
        action_centered_map: data.action_centered_map,
        color,
        fontSize,
        mapScale,
        theme,
        type_data_map: groupTypeTime as MySettingsResponse['type_data_map'],
        type_show_del: type_show_del as MySettingsResponse['type_show_del'],
        update_interval,
        night_map: data.night_map,
        is_scaleMap: data.is_scaleMap,
      });

      useGlobalStore.getState().showAlertText(true, 'Настройки сохранены');
      useGlobalStore.getState().setFontSize(fontSize);
      useGlobalStore.getState().setTheme(theme);
      useGlobalStore.getState().setMapScale(mapScale);
      useOrdersStore.getState().setUpdateInterval(update_interval);

    } catch (e) {

      Analytics.log(AnalyticsEvent.SettingsSaveFail, 'Ошибка в сохранение настроек');
      useGlobalStore.getState().showModalText(true, 'Не удалось сохранить настройки');

    } finally {

      setTimeout(() => {
        set({ isClick: false });
        useGlobalStore.getState().setSpinner(false);
      }, 300);

    }
  },

  getPhoneCafe: async () => {
    const token = await useGlobalStore.getState().getAuthToken();

    const data = {
      token,
      type: 'get_point_phone',
      ...(get().point_id ? { point_id: get().point_id } : {}),
    };

    const json = await api<getPhoneCafeResponse>('settings', data);

    if( json.st === false ){
      useGlobalStore.getState().setSpinner(false);
      return ;
    }

    useGlobalStore.getState().setPhone(json.data?.phone ?? null);
  },
}))

export const useGEOStore = create<GEOStore>()((set, get) => ({
  check_pos_check: false,
  driver_location_requesting: false,
  //driver_need_gps: false,
  driver_pos: '',
  driver_pos_accuracy: 0,
  driver_pos_latitude: 0,
  driver_pos_longitude: 0,

  location_driver: null,
  location_driver_time_text: '',

  type_location: 'none',
  id_watch: null,

  check_pos: async (func, data, is_show_error = true) => {
    const granted = await get().getLocationPermissions();

    if (granted) {

      Geolocation.getCurrentPosition(
        ({coords, mocked}: ExtendedGeolocationResponse) => {
          if (!mocked) {
            const {latitude, longitude, accuracy} = coords;

            func({latitude, longitude, data, accuracy});
          }else{
            if( is_show_error ){
              useGlobalStore.getState().showModalText(true, 'Не удалось определить местоположение. Возможно, данные были подменены.');
            }

            setTimeout( () => {
              useGlobalStore.getState().setSpinner(false);
            }, 300 )
          }
        },
        ({message}) => {
          if( is_show_error ){
            useGlobalStore.getState().showModalText(true, 'Не удалось определить местоположение. ' + message);
          }

          setTimeout( () => {
            useGlobalStore.getState().setSpinner(false);
          }, 300 )
        },
        {
          maximumAge: 3000, 
          enableHighAccuracy: true,
        }
      );
    }else{
      if( is_show_error ){
        useGlobalStore.getState().showModalText(true, 'Вы запретили отслеживание геолокации');
      }

      setTimeout( () => {
        useGlobalStore.getState().setSpinner(false);
      }, 300 )
    }
  },

  check_pos_fake: (func, data, is_show_error = true) => {
    
    const latitude = 0;
    const longitude = 0;
    const accuracy = 0;

    func({latitude, longitude, data, accuracy});
          
    setTimeout( () => {
      useGlobalStore.getState().setSpinner(false);
    }, 300 )
    
  },

  checkMyPos: () => {
    if( useOrdersStore.getState().driver_need_gps) {
      return;
    }

    if (!get().check_pos_check) {
      set({
        check_pos_check: true,
      });
    } else {
      return;
    }

    get().check_pos(get().saveMyPos, {}, false);

    setTimeout(() => {
      set({
        check_pos_check: false,
      });
    }, 1000);
  },

  saveMyPos: async ({latitude, longitude}) => {
    const token = await useGlobalStore.getState().getAuthToken();

    if (token && token.length > 0) {
      const data = {
        token: token,
        type: 'save_my_pos',
        latitude,
        longitude,
      };

      await api('settings', data);
    }
  },

  setDriverPos: async ({latitude, longitude}) => {
    let now = new Date();
    let min = now.getMinutes();

    set({
      location_driver: {lon: longitude, lat: latitude},
      location_driver_time_text: now.getHours() + ':' + ( min < 10 ? '0' + min : min)
    })

    useGlobalStore.getState().setSpinner(false);
  },

  // показать текущее местоположение водителя
  showLocationDriver: async() => {
    if (get().driver_location_requesting) return false

    Analytics.log(AnalyticsEvent.DriverLocation, 'Показать текущее местоположение водителя на карте');

    useGlobalStore.getState().setSpinner(true);

    set({
      driver_location_requesting: true,
      location_driver: null,
      location_driver_time_text: ''
    })

    try {
      const granted = await get().getLocationPermissions()

      if (!granted) {
        useGlobalStore.getState().showModalText(
          true,
          'Нет доступа к геолокации. Разрешите доступ к местоположению в настройках телефона.',
        )
        return false
      }

      let position: ExtendedGeolocationResponse

      try {
        position = await requestCurrentPosition({
          enableHighAccuracy: true,
          timeout: DRIVER_LOCATION_FIRST_TIMEOUT_MS,
          maximumAge: 0,
        })
      } catch (firstError) {
        if (isLocationPermissionError(firstError)) throw firstError

        position = await requestCurrentPosition({
          enableHighAccuracy: false,
          timeout: DRIVER_LOCATION_RETRY_TIMEOUT_MS,
          maximumAge: 60000,
        })
      }

      if (position.mocked) {
        useGlobalStore.getState().showModalText(
          true,
          'Не удалось определить местоположение. Возможно, данные были подменены.',
        )
        return false
      }

      await get().setDriverPos(position.coords)
      return true
    } catch (error) {
      useGlobalStore.getState().showModalText(true, getDriverLocationErrorText(error))
      return false
    } finally {
      set({ driver_location_requesting: false })
      useGlobalStore.getState().setSpinner(false)
    }
  },

  set_type_location: async () => {
    const type_location = get().type_location;

    if(type_location === 'none') {
      const didFindLocation = await get().showLocationDriver();

      if (!didFindLocation || get().type_location !== 'none') return

      set({
        type_location: 'location'
      })

      setTimeout(() => {
        if (get().type_location === 'location') {
          set({
            type_location: 'none',
            location_driver: null,
            location_driver_time_text: '',
          })
        }
      }, 30000)

      return ;
    }

    if(type_location === 'location') {
      get().MyCurrentLocation();

      set({
        type_location: 'watch'
      })

      return ;
    }

    if(type_location === 'watch') {
      const id_watch = get().id_watch;

      set({
        type_location: 'none',
        location_driver: null,
        location_driver_time_text: '',
      })

      if(id_watch) {
        Geolocation.clearWatch(id_watch);

        setTimeout(() => {
          set({
            id_watch: null,
          })
          
        }, 300);
      }

      return ;
    }

  },

  MyCurrentLocation: async() => {
    try {
      const granted = await get().getLocationPermissions();

      if (granted) {
        const id_watch = Geolocation.watchPosition(
          ({coords, mocked}: ExtendedGeolocationResponse) => {
            if( !mocked ){
              const {latitude, longitude, accuracy} = coords;
  
              let now = new Date();
              let min = now.getMinutes();

              set({
                location_driver: {lon: longitude, lat: latitude, accuracy: accuracy},
                location_driver_time_text: now.getHours() + ':' + ( min < 10 ? '0' + min : min )
              })

              // setTimeout(() => {
              //   const type_location = get().type_location;
    
              //   if(type_location === 'none') {
              //     set({
              //       type_location: 'watch',
              //     })
              //   } 
              // }, 100);
              
              
            }
          },
          ({message}) => {
            
          },
          {
            maximumAge: 3000, 
            enableHighAccuracy: true,
            timeout: 10000,
          }
        );

        
        set({id_watch});
      }

    
    } catch (err) {
    
      
    }
    
  },

  getLocationPermissions: async () => {
    const granted = await request(
      Platform.select({
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      })!,
      {
        title: 'Жако Курьер',
        message: 'Геолокация нужна в момент завершения заказа',
        buttonPositive: 'OK',
      },
    );
    return granted === RESULTS.GRANTED;
  },
}))

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

  types_dop: [
    {id: 1, text: 'В очереди'},
    {id: 2, text: 'Готовится'},
    {id: 3, text: 'Собран'},
  ],
  typeToStatus: {
    '1': 'В очереди',
    '2': 'Готовится',
    '3': 'Собран',
  },

  type_dop: ['1', '2', '3'],
  is_showModalTypeDop: false,

  limit_summ: '',
  limit_count: '',

  orders: [],
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

  // показ модалки выбора доп. типов заказов
  showModalTypeDop: ( is_show: boolean ) => {

    Analytics.log(
      is_show ? AnalyticsEvent.OrdersTypeDopModalOpen : AnalyticsEvent.OrdersTypeDopModalClose,
      is_show ? 'Открытие модалки доп. типов заказов на карте' : 'Закрытие модалки доп. типов заказов на карте'
    );

    set({is_showModalTypeDop: is_show});
  },

  setTypeDop: (type: string[]) => {
    if( type.length == 0 ){
      type = ['1', '2', '3'];
    } 
    set({type_dop: type});

    get().getOrders(true);
  },

  filterOrdersByTypes: <T extends { status: string }>(
    orders: T[],
    types: string[]
  ): T[]  => {
    const typeToStatus = get().typeToStatus;

    
    // Получаем массив статусов, по которым нужно фильтровать
    const statuses = types.map(type => typeToStatus[type]);
    return orders.filter(order => statuses.includes(order.status));
  },

  // получение заказов
  getOrders: async (is_reload = false) => {
    const token = await useGlobalStore.getState().getAuthToken();

    const type_dop = get().type_dop;
    const types_dop = get().types_dop;
    const type = get().type;

    if (!token || token.length == 0) {
      return;
    }

    if (!get().is_check) {
      set({
        is_check: true,
      });
    } else {
      return;
    }

    if (is_reload) {
      useGlobalStore.getState().setSpinner(true);
    }else{
      useGlobalStore.getState().setSpinnerHidden(true);
    }

    const data = {
      type: 'get_orders',
      type_orders: get().type.id,
      token: token,
      ...(useSettingsStore.getState().point_id ? { point_id: useSettingsStore.getState().point_id } : {}),
    };

    try {
      const json = await api<GetOrdersResponse>('orders', data);

      if( json.st === false ){
        Analytics.log(AnalyticsEvent.OrdersFetchFail, 'Ошибка при получении списка заказов');

        useGlobalStore.getState().setSpinner(false);
        set({
          is_check: false,
        });
        return ;
      }

      if (json.data?.orders) {
        let orders = json.data?.orders;

        if( type.id == 1 && type_dop.length !== types_dop.length ){
          orders = get().filterOrdersByTypes(orders, type_dop);
        }

        const nextHome = json.data?.home
        const prevHome = get().home
        const homeUnchanged = !!(
          prevHome &&
          nextHome &&
          Number(prevHome.lat) === Number(nextHome.lat) &&
          Number(prevHome.lon) === Number(nextHome.lon)
        )

        set({
          orders: orders,
          limit_summ: json.data?.limit,
          limit_count: json.data?.limit_count,
          update_interval: json.data?.update_interval,
          driver_need_gps: json.data?.driver_need_gps == 1 ? true : false,
          home: homeUnchanged ? prevHome : (nextHome ?? prevHome),
          //del_orders: json?.arr_del_list,
          //driver_pay: json?.driver_pay,
        });

      } else {
        Analytics.log(AnalyticsEvent.OrdersFetchFail, 'Ошибка при получении списка заказов');
        useGlobalStore.getState().showModalText(true, json.text);
      }
    } catch (err) {
      console.log(err);
      Analytics.log(AnalyticsEvent.OrdersFetchFail, 'Ошибка при получении списка заказов');
    }

    setTimeout(() => {
      set({
        is_check: false,
      });

      useGlobalStore.getState().setSpinner(false);
      useGlobalStore.getState().setSpinnerHidden(false);
    }, 300);
  },

  // выбор типа заказа
  selectType: (item: TypeOrder) => {
    Analytics.log(AnalyticsEvent.OrderSelect, 'Выбор типа заказа');

    set({type: item});
    get().getOrders(true);
  },

  // интервал обновления заказов
  setUpdateInterval: (interval: number) => { set({update_interval: interval}) },
  
  // завершение/отмена/клиент не вышел на связь заказа при подтвреждении в модалке на страницах Список заказов / Заказы на карте
  actionButtonOrder: (type: number, order_id: number) => {
    if (get().isClick === false) {
      set({isClick: true});
    } else {
      return;
    }
    
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

    const callWithGeo = (cb: any, payload: any) => {
      if (get().driver_need_gps) {
        useGEOStore.getState().check_pos(cb, payload);
      } else {
        useGEOStore.getState().check_pos_fake(cb, payload);
      }
    };

    if (type === 1) {
      // "Взять" заказ:
      // если это НЕ из модалки "fake" — всегда обычный путь
      if (isConfirmFake) {
        // кейс "Клиент не вышел на связь" подтверждён в модалке
        callWithGeo(get().actionOrderFake, { order_id, type });
      } else {
        // обычное "Взять" — игнорируем залипший type_confirm
        useGEOStore.getState().check_pos_fake(get().actionOrder, { order_id, type });
      }
    } else {
      // type === 2/3 — отмена/завершение: нужна обычная гео-проверка
      callWithGeo(get().actionOrder, { order_id, type });
    }

    setTimeout(() => {
      set({isClick: false});
    }, 300);

  },
 
  actionOrder: async ({data: {order_id, type}, latitude = '', longitude = ''}) => {

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
        ...(useSettingsStore.getState().point_id ? { point_id: useSettingsStore.getState().point_id } : {}),
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
        get().showOrdersMap(-1);  // свернуть/закрыть карту/модалку
      }

      if (type === 1 || type === 2) {
        get().requestMapHomeCenter();
      }

      get().getOrders(); // ручной рефреш списка

      // закрываем confirm только если он был открыт
      if (get().is_modalConfirm) {
        get().setActiveConfirm(false);
      }

    } finally {

      // Всегда гасим спиннер и снимаем «клик», даже при исключении
      useGlobalStore.getState().setSpinner(false);
      set({ isClick: false });

    }
    
  },

  actionOrderFake: async ({ data: {order_id}, latitude = '', longitude = '', accuracy = 0 }) => {

    const token = await useGlobalStore.getState().getAuthToken();
    useGlobalStore.getState().setSpinner(true); // включаем тут, выключим в finally

    try {

      const data = {
        type: 'checkFakeOrder',
        token: token,
        order_id: order_id,
        latitude: latitude,
        longitude: longitude,
        ...(useSettingsStore.getState().point_id ? { point_id: useSettingsStore.getState().point_id } : {}),
      };

      const res = await api<StatusTextType>('orders', data);

      if (res?.st === false) {
        useGlobalStore.getState().showModalText(true, res.text);

        return;
      }

      // УСПЕХ: вручную обновляем UI (раньше тут не было showOrdersMap(-1) — из-за этого «ничего не происходило» при отключённом автообновлении)
      // закрываем карту только если она реально открыта (чтобы не сыпались лишние события/логирование)
      if (get().isOpenOrderMap) {
        get().showOrdersMap(-1);  // свернуть/закрыть карту/модалку
      }

      get().getOrders();

    } finally {
      useGlobalStore.getState().setSpinner(false);
      set({ isClick: false });
    }
   
  },

  // открытие/закрытие модалки с подтверждением завершения заказа
  setActiveConfirm: (active, order_id, type_confirm, order_confirm_is_delete) => {

    if (active) {
      Analytics.log(AnalyticsEvent.ConfirmModalOpen, 'Открытие модалки подтверждения заказа');
    } else {
      Analytics.log(AnalyticsEvent.ConfirmModalClose, 'Закрытие модалки подтверждения заказа');
    }

    set({
      //type_confirm,
      type_confirm: active ? type_confirm : '',         // ← сбрасываем при закрытии, изменения после тестирования
      order_confirm_id: order_id,
      is_modalConfirm: active,
      order_confirm_is_delete
    });
  },

  requestMapHomeCenter: () => {
    if (useSettingsStore.getState().action_centered_map == 1) {
      set({
        mapHomeCenterRequestId: get().mapHomeCenterRequestId + 1
      })
    }
  },

  // открытие заказа на карте
  showOrdersMap: (id: number) => {
    if ( id === -1) {

       // логируем закрытие ТОЛЬКО если реально было открыто
      if (get().isOpenOrderMap) {
        Analytics.log(AnalyticsEvent.OrderMapClose, 'Закрытие заказа на карте');
        set({
          isOpenOrderMap: false
        });
      }

      return;
    }

    const order = get().orders.find(item => item.id === id);

    if (order) {
      const new_orders = get().orders.filter(item => item.addr === order.addr && item.pd === order.pd);

      Analytics.log(AnalyticsEvent.OrderMapOpen, 'Открытие заказа на карте');
      
      set({
        showOrders: new_orders,
        isOpenOrderMap: true,
      });
    }
  }
}))

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  is_click: false,
  feedbacks: [],
  isLoading: false,
  error: null,
  modal: {
    isCreateModalOpen: false,
    isViewModalOpen: false,
    selectedFeedback: null,
  },
  chooseStatus: '',
  searchQuery: '',

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  
  setStatus: (status: FeedbackStatus) => set({ chooseStatus: status }),

  fetchFeedbacks: async () => {
    useGlobalStore.getState().setSpinner(true);

    try {
      const feedbacks = await fetchLaravelFeedbacks();
      set({ feedbacks });
    } catch (error) {
      set({ error: getLaravelApiErrorInfo(error).message });
    }

    setTimeout(() => {
      useGlobalStore.getState().setSpinner(false);
    }, 300);
  },
  
  fetchFeedbackById: async (id: number) => {
    const feedback = get().feedbacks.find(item => item.id === id) ?? null;
    set({
      modal: {
        ...get().modal,
        selectedFeedback: feedback,
        isCreateModalOpen: false,
        isViewModalOpen: feedback !== null,
      },
    });
  },
  
  // Создание предложения
  createFeedback: async (feedback) => {

    if( get().is_click == true ){
      return;
    }else{
      set({is_click: true});
    }

    useGlobalStore.getState().setSpinner(true);

    try {
      await createLaravelFeedback({
        title: feedback.title,
        description: feedback.description,
        type: feedback.type,
        is_need_notification: feedback.is_need_notification,
        images: feedback.images ?? [],
      });

      Analytics.log(AnalyticsEvent.FeedbackCreate, 'Создание предложения');
      useGlobalStore.getState().showAlertText(true, 'Спасибо за обратную связь!');
      get().closeCreateModal();
      await get().fetchFeedbacks();
    } catch (error) {
      useGlobalStore.getState().showAlertText(
        true,
        getLaravelApiErrorInfo(error).message || 'Произошла ошибка при записи, попробуйте ещё раз',
      );
    } finally {
      setTimeout(() => {
        useGlobalStore.getState().setSpinner(false);
        set({is_click: false});
      }, 300);
    }
  },
  
  // Открытие модалки создания обратной связи
  openCreateModal: () => {
    const m = get().modal;
    if (!m.isCreateModalOpen) {
      Analytics.log(AnalyticsEvent.FeedbackModalOpen, 'Открытие модалки обратной связи');
    }
    set({ modal: { ...m, isCreateModalOpen: true } });
  },

  // Закрытие модалки создания обратной связи
  closeCreateModal: () => {
    const m = get().modal;
    if (m.isCreateModalOpen) {
      Analytics.log(AnalyticsEvent.FeedbackModalClose, 'Закрытие модалки обратной связи');
    }
    set({ modal: { ...m, isCreateModalOpen: false } });
  },

  openViewModal: (feedback) => {
    set({ 
      modal: { 
        isCreateModalOpen: false, 
        isViewModalOpen: true, 
        selectedFeedback: feedback 
      } 
    })
  },
  closeViewModal: () => set({ 
    modal: { 
      ...get().modal, 
      isViewModalOpen: false, 
      selectedFeedback: null 
    } 
  }),
}));
