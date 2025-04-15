import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage';

import Geolocation, { GeolocationResponse } from '@react-native-community/geolocation';
import {request, PERMISSIONS, RESULTS, checkMultiple} from 'react-native-permissions';
import {Platform} from 'react-native';

import { api } from './api';
import { Theme, ShowType } from '@/shared/types/globalTypes'
import { globalTypes } from './GlobalStoreType';
import { StatusTextType, LoginTypes, CheckTokenResponse, LoginResponse } from './LoginStoreType';
import { StatTypes, PriceResponse, GraphResponse, GraphErrCam, GraphErrOrder, AnswerErrCamResponse, StatResponse } from './StatStoreType';
import { MySettingsResponse, SettingsStore, SaveSettingsResponse, getPhoneCafeResponse, phoneType } from './SettingsStoreType';

import { OrdersStore, GetOrdersResponse, TypeOrder, actionOrderType } from './OrdersStoreType';
import { FeedbackType, FeedbackStatus, Feedback, ModalState, FeedbackState, fetchFeedbacksResponse, fetchFeedbackResponse, createFeedbackResponse } from './FeedbackStoreType'

import { GEOStore } from './GEOStoreType';

import dayjs, { ConfigType } from 'dayjs'
import 'dayjs/locale/ru'

dayjs.locale('ru')

interface ExtendedGeolocationResponse extends GeolocationResponse {
  mocked?: boolean;
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
  is_need_page_stat: true,

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
    await AsyncStorage.setItem('token', token); 
  },

  getTokenAuth: async (): Promise<string> => { 
    const token = await AsyncStorage.getItem('token');

    return token ?? '';
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
  
    initialPage: '',
    loginErr: '',
  
    wallpaper_btn: false,
    formAuth: true,
  
    auth: async (login: string, pwd: string): Promise<StatusTextType> => {
      if (!get().is_load) {
        set({is_load: true});
      } else {
        return { st: false, text: "Пожалуйста, подождите..." };
      }
      
      useGlobalStore.getState().setSpinner(true);
  
      const data = {
        type: 'login',
        login: login,
        pwd: pwd,
      };
  
      const json = await api<LoginResponse>('auth', data);
  
      if (json?.st === true) {
        useGlobalStore.getState().setTokenAuth(json.data?.token ?? '');

        useSettingsStore.getState().getSettings();
      }else{
        useGlobalStore.getState().showModalText(true, json.data?.text);
      }

      setTimeout( () => {
        set({is_load: false});
        useGlobalStore.getState().setSpinner(false);
      }, 500 )
      
      return { st: json.st, text: json?.text ?? '' };
    },

    sendSMS: async (login: string, pwd: string): Promise<StatusTextType> => {
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
      };
  
      const json = await api<LoginResponse>('auth', data);
  
      if( json.st === false){
        useGlobalStore.getState().showModalText(true, json.text);
      }

      setTimeout( () => {
        set({is_load: false});
        useGlobalStore.getState().setSpinner(false);
      }, 500 )
      
      return { st: json.st, text: json?.text ?? '' };
    },

    sendCode: async (login: string, code: string): Promise<StatusTextType> => {
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
        useGlobalStore.getState().setTokenAuth(json.data?.token ?? '');

        useSettingsStore.getState().getSettings();
      }else{
        useGlobalStore.getState().showModalText(true, json.text);
      }
  
      setTimeout( () => {
        set({is_load: false});
        useGlobalStore.getState().setSpinner(false);
      }, 500 )
  
      return { st: json.st, text: json?.text ?? '' };
    },

    check_token: async () => {
      const token = await useGlobalStore.getState().getAuthToken();

      if( !token || token.length == 0 ){
        return false;
      }

      const data = {
        type: 'check_token',
        token: token
      };
  
      const json = await api<CheckTokenResponse>('auth', data);

      if( json.st === true ){
        useGlobalStore.getState().setTokenAuth(token);

        useSettingsStore.getState().getSettings();
      }

      return json.st;
    },

    logogout: () => { useGlobalStore.getState().setTokenAuth(''); },
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

  showModalErrCam(is_show: boolean, err?: GraphErrCam | null): void {
    set({
      isShowModalErrCam: is_show,
      modalErrCam: err
    })
  },

  showModalErrOrder(is_show: boolean, err?: GraphErrOrder | null): void {
    set({
      isShowModalErrOrder: is_show,
      modalErrOrder: err
    })
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
      useGlobalStore.getState().showModalText(true, res?.text);
    } else {
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
      date_end
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

  setRotateMap: (is_rotate) => {
    set({
      rotate_map: is_rotate,
    })
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

    get().getPhoneCafe();

    useGlobalStore.getState().setFontSize(parseInt(res.data?.fontSize ?? 16));
    useGlobalStore.getState().setTheme(res.data?.theme ?? 'white');
    //useGlobalStore.getState().setMapScale( parseFloat(res.data?.mapScale ?? 1) );
    useGlobalStore.getState().setMapScale( parseFloat(res.data?.mapScale ?? 1) );

    useGlobalStore.getState().setNeedAvgTime( (res.data?.driver_avg_time ?? 1) == 1 ? true : false );
    useGlobalStore.getState().setNeedPageStat( (res.data?.driver_page_stat_time ?? 1) == 1 ? true : false );
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

    await api<SaveSettingsResponse>('settings', data);

    useGlobalStore.getState().showAlertText(true, 'Настройки сохранены');
    
    useGlobalStore.getState().setFontSize(fontSize);
    useGlobalStore.getState().setTheme(theme);
    useGlobalStore.getState().setMapScale(mapScale);

    setTimeout(() => {
      set({isClick: false});

      useGlobalStore.getState().setSpinner(false);
    }, 300);
  },

  getPhoneCafe: async () => {
    const token = await useGlobalStore.getState().getAuthToken();

    const data = {
      token,
      type: 'get_point_phone',
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
          enableHighAccuracy: true 
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

  showLocationDriver: async() => {
    useGlobalStore.getState().setSpinner(true);
  
    set({
      location_driver: null,
      location_driver_time_text: ''
    })

    get().check_pos(get().setDriverPos, {});
  },

  set_type_location: () => {
    const type_location = get().type_location;

    if(type_location === 'none') {
      get().showLocationDriver();
      set({
        type_location: 'location'
      })
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
              
              
            }else{
              
            }
          },
          ({message}) => {
            
          },
          {
            maximumAge: 3000, 
            enableHighAccuracy: true 
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
    {id: 5, text: 'У других'},
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

  update_interval: 30,
  driver_need_gps: true,

  type_confirm: '',
  order_confirm_id: 0,
  is_modalConfirm: false,
  order_confirm_is_delete: false,

  showOrders: [],
  isOpenOrderMap: false,

  showModalTypeDop: ( is_show: boolean ) => {
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
    };

    try {
      const json = await api<GetOrdersResponse>('orders', data);

      if( json.st === false ){
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

        set({
          orders: orders,
          limit_summ: json.data?.limit,
          limit_count: json.data?.limit_count,
          update_interval: json.data?.update_interval,
          driver_need_gps: json.data?.driver_need_gps == 1 ? true : false,
          home: json.data?.home,
          //del_orders: json?.arr_del_list,
          //driver_pay: json?.driver_pay,
        });

      } else {
        useGlobalStore.getState().showModalText(true, json.text);
      }
    } catch (err) {
      console.log(err);
    }

    setTimeout(() => {
      set({
        is_check: false,
      });

      useGlobalStore.getState().setSpinner(false);
      useGlobalStore.getState().setSpinnerHidden(false);
    }, 300);
  },
  selectType: (item: TypeOrder) => {
    set({type: item});
    get().getOrders(true);
  },
  setUpdateInterval: (interval: number) => { set({update_interval: interval}) },
  
  actionButtonOrder: (type: number, order_id: number) => {
    if (get().isClick === false) {
      set({isClick: true});
    } else {
      return;
    }
    
    useGlobalStore.getState().setSpinner(true);
    
    if( get().driver_need_gps ){
      if(type === 1 && get().type_confirm === 'fake') {
        useGEOStore.getState().check_pos( get().actionOrderFake, {order_id, type} );
      } else {
        if( type === 1 ){
          useGEOStore.getState().check_pos_fake( get().actionOrder, {order_id, type} );
        }else{
          useGEOStore.getState().check_pos( get().actionOrder, {order_id, type} );
        }
      }
    }else{
      
      if(type === 1 && get().type_confirm === 'fake') {
        useGEOStore.getState().check_pos_fake( get().actionOrderFake, {order_id, type} );
      } else {
        useGEOStore.getState().check_pos_fake( get().actionOrder, {order_id, type} );
      }
    }

    setTimeout(() => {
      //get().setActiveConfirm(false, null, null, null)
      set({isClick: false});
    }, 300);
  },
  // завершение/отмена/клиент не вышел на связь заказа при подтвреждении в модалке на страницах Список заказов / Заказы на карте
  actionOrder: async ({data: {order_id, type}, latitude = '', longitude = ''}) => {
    //1 - get / 2 - close / 3 - finish
    const token = await useGlobalStore.getState().getAuthToken();

    const data = {
      type: 'actionOrder',
      token: token,
      id: order_id,
      type_action: type,
      appToken: useGlobalStore.getState().notifToken,
      latitude: latitude,
      longitude: longitude,
    };

    const res = await api<StatusTextType>('orders', data);

    if (res?.st === false) {
      useGlobalStore.getState().showModalText(true, res.text);

      setTimeout(() => {
        useGlobalStore.getState().setSpinner(false);
      }, 500);
    } else {
      //get().closeOrderMap();
      //get().setShowPay(false);
      get().showOrdersMap(-1);
      get().getOrders();

      setTimeout(() => {
        useGlobalStore.getState().setSpinner(false);
        //get().closeOrderMap();
        get().setActiveConfirm(false);
      }, 500);
    }
  },
  actionOrderFake: async ({ data: {order_id}, latitude = '', longitude = '', accuracy = 0 }) => {
    const token = await useGlobalStore.getState().getAuthToken();

    const data = {
      type: 'checkFakeOrder',
      token: token,
      order_id: order_id,
      latitude: latitude,
      longitude: longitude,
    };

    const res = await api<StatusTextType>('orders', data);

    if (res?.st === false) {
      useGlobalStore.getState().showModalText(true, res.text);

      setTimeout(() => {
        useGlobalStore.getState().setSpinner(false);
      }, 500);
    } else {
      
      // let now = new Date();
      // let min = now.getMinutes();

      // if( parseInt(min) < 10) {
      //   min = '0' + min;
      // }

      // set({
      //   location_driver: {lon: longitude, lat: latitude, accuracy: parseFloat(accuracy)},
      //   location_driver_time_text: now.getHours() + ':' + min
      // })
      
      //get().closeOrderMap();
      get().getOrders();

      setTimeout(() => {
        useGlobalStore.getState().setSpinner(false);
      }, 500);

      // setTimeout(() => {
      //   set({
      //     location_driver: null
      //   })
      // }, 30000);
    }
  },
  // открытие/закрытие модалки с подтверждением завершения заказа
  setActiveConfirm: (active, order_id, type_confirm, order_confirm_is_delete) => {
    set({
      type_confirm,
      order_confirm_id: order_id,
      is_modalConfirm: active,
      order_confirm_is_delete
    });
  },
  showOrdersMap: (id: number) => {
    if ( id === -1) {
      set({
        isOpenOrderMap: false
      });
      return;
    }

    const order = get().orders.find(item => item.id === id);

    if (order) {
      const new_orders = get().orders.filter(item => item.addr === order.addr && item.pd === order.pd);
      
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
    const token = await useGlobalStore.getState().getAuthToken();
    useGlobalStore.getState().setSpinner(true);

    const data = {
      type: 'get_feedbacks',
      token: token,
    };

    try {
      const response = await api<fetchFeedbacksResponse>('feedback', data);
      
      if( response.st === false ){
        useGlobalStore.getState().setSpinner(false);
        return ;
      }

      set({ feedbacks: response?.data?.feedbacks });
    } catch (error) {
      
    }

    setTimeout(() => {
      useGlobalStore.getState().setSpinner(false);
    }, 300);
  },
  
  fetchFeedbackById: async (id: number) => {
    const token = await useGlobalStore.getState().getAuthToken();
    useGlobalStore.getState().setSpinner(true);

    const data = {
      type: 'get_feedback_id',
      id: id,
      token: token,
    };

    try {
      const response = await api<fetchFeedbackResponse>('feedback', data);
      
      if( response.st === false ){
        useGlobalStore.getState().setSpinner(false);
        return ;
      }

      set({ 
        modal: { ...get().modal, selectedFeedback: response?.data?.feedback ?? null, isCreateModalOpen: false, isViewModalOpen: true }
      });
    } catch (error) {
      
    }

    setTimeout(() => {
      useGlobalStore.getState().setSpinner(false);
    }, 300);
  },
  
  createFeedback: async (feedback) => {

    if( get().is_click == true ){
      return;
    }else{
      set({is_click: true});
    }

    const token = await useGlobalStore.getState().getAuthToken();
    useGlobalStore.getState().setSpinner(true);

    const data = {
      type: 'create_feedback',
      token: token,
      feedback_title: feedback.title,
      feedback_description: feedback.description,
      feedback_type: feedback.type,
      feedback_is_need_notification: feedback.is_need_notification,
      notifToken: useGlobalStore.getState().notifToken
    };

    try {
      //createFeedbackResponse
      const response = await api<createFeedbackResponse>('feedback', data);

      if( response?.data?.st == true ){

        const successInfo = await get().uploadImages(response?.data?.id, feedback.images ?? []);

        if (successInfo.success) {
          setTimeout(() => {
            useGlobalStore.getState().setSpinner(false);
            set({is_click: false});
          }, 300);

          useGlobalStore.getState().showAlertText(true, 'Спасибо за обратную связь!');
          get().closeCreateModal();
          get().fetchFeedbacks();
        } else {
          setTimeout(() => {
            useGlobalStore.getState().setSpinner(false);
            set({is_click: false});
          }, 300);

          useGlobalStore.getState().showAlertText(true, 'Спасибо за обратную связь!');
          get().closeCreateModal();
          get().fetchFeedbacks();
        }

        
      }else{
        useGlobalStore.getState().showAlertText(true, 'Произошла ошибка при записи, попробуй еще раз');

        setTimeout(() => {
          useGlobalStore.getState().setSpinner(false);
          set({is_click: false});
        }, 300);
      }
      
    } catch (error) {
      setTimeout(() => {
        useGlobalStore.getState().setSpinner(false);
        set({is_click: false});
      }, 300);
    }

    
  },
  
  openCreateModal: () => set({ modal: { ...get().modal, isCreateModalOpen: true } }),
  closeCreateModal: () => set({ modal: { ...get().modal, isCreateModalOpen: false } }),
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

  uploadImages: async (id, images) => {
    // Если нет изображений, пропускаем
    if (!images || images.length === 0) {
      return {
        success: true,
        message: 'No images to upload',
      };
    }

    try {
      const data = new FormData();

      images.forEach((img, index) => {
        const uri = img.uri;
        if (!uri) return; // пропускаем отсутствующую URI

        // MIME-тип
        const mimeType = img.type ?? 'image/jpeg';

        // Определяем расширение
        // можно попробовать получить из fileName, иначе default ".jpg"
        let extension = '.jpg';
        if (img.fileName) {
          const dotIndex = img.fileName.lastIndexOf('.');
          if (dotIndex !== -1) {
            extension = img.fileName.substring(dotIndex); // например, ".png"
          }
        }

        // Генерируем имя файла: "{id}_{index}.{extension}"
        const fileName = `${id}_${index}${extension}`;

        data.append('images[]', {
          uri,
          type: mimeType,
          name: fileName,
        } as any);
      });

      // Отправляем ID записи тоже, если нужно на сервере
      data.append('record_id', String(id));

      const response = await fetch('https://api.jacochef.ru/driver/image/upload-images.php', {
        method: 'POST',
        body: data,
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Server returned status ${response.status}`,
        };
      }

      const json = await response.json();
      // Допустим, сервер возвращает { success: boolean, message: string }
      return {
        success: !!json.success,
        message: json.message ?? 'Server response',
      };
    } catch (error) {
      console.error('Error uploading images:', error);
      return {
        success: false,
        message: String(error),
      };
    }
  },
}));