import {create} from 'zustand';
import {api} from './api';
import {isAppOffline} from '@/shared/lib/connectivityState';
import {
  StatTypes,
  PriceResponse,
  GraphResponse,
  GraphErrCam,
  GraphErrOrder,
  AnswerErrCamResponse,
  StatResponse,
} from './StatStoreType';
import dayjs, {ConfigType} from 'dayjs';
import 'dayjs/locale/ru';
import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';
import {useGlobalStore} from './globalStore';
import {useSettingsStore} from './settingsStore';

dayjs.locale('ru');

let priceRequestId = 0;
let graphRequestId = 0;
let statisticsRequestId = 0;

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
    return dayjs(date).format('DD MMMM YYYY');
  },

  getStatPrice: async (date: string): Promise<void> => {
    if (isAppOffline()) return;

    useGlobalStore.getState().setSpinner(true);

    const token = await useGlobalStore.getState().getAuthToken();

    const data = {
      date,
      token,
      type: 'get_my_price',
      ...(useSettingsStore.getState().point_id
        ? {point_id: useSettingsStore.getState().point_id}
        : {}),
    };

    const response = await api<PriceResponse>('price', data);

    if (response.st === false) {
      useGlobalStore.getState().setSpinner(false);
      return;
    }

    set({
      statPrice: response.data?.stat ?? null,
      give_history: response.data?.give_hist ?? [],
    });

    setTimeout(() => {
      useGlobalStore.getState().setSpinner(false);
    }, 500);
  },

  getStatBetween: async (dateStart, dateEnd) => {
    if (isAppOffline()) return true;

    const requestId = ++priceRequestId;
    if (!get().statPrice) useGlobalStore.getState().setSpinner(true);

    const token = await useGlobalStore.getState().getAuthToken();

    const data = {
      token: token,
      type: 'get_my_price_between',
      dateStart,
      dateEnd,
      ...(useSettingsStore.getState().point_id
        ? {point_id: useSettingsStore.getState().point_id}
        : {}),
    };

    const response = await api<PriceResponse>('price', data);

    if (requestId !== priceRequestId || isAppOffline()) {
      useGlobalStore.getState().setSpinner(false);
      return true;
    }

    if (response.st === false) {
      useGlobalStore.getState().setSpinner(false);
      return !response.retryable;
    }

    set({
      statPrice: response.data?.stat,
      give_history: response.data?.give_hist,
    });

    useGlobalStore.getState().setSpinner(false);
    return true;
  },

  setGraphDate: (date: string): void => {
    set({dateGraph: date});
  },

  getGraph: async (date?: string | null): Promise<boolean> => {
    if (isAppOffline()) return true;

    const requestId = ++graphRequestId;
    if (get().dates.length === 0 && get().err_orders.length === 0 && get().err_cam.length === 0) {
      useGlobalStore.getState().setSpinner(true);
    }

    if (date) {
      set({
        dateGraph: date,
      });
    } else {
      date = get().dateGraph;
    }

    const token = await useGlobalStore.getState().getAuthToken();

    const data = {
      date,
      token,
      type: 'get_my_graph',
      ...(useSettingsStore.getState().point_id
        ? {point_id: useSettingsStore.getState().point_id}
        : {}),
    };

    const response = await api<GraphResponse>('graph', data);

    if (requestId !== graphRequestId || isAppOffline()) {
      useGlobalStore.getState().setSpinner(false);
      return true;
    }

    if (response.st === false) {
      useGlobalStore.getState().setSpinner(false);
      return !response.retryable;
    }

    set({
      month_list: response?.data?.mounth ?? [],
      dates: response?.data?.all_dates ?? [],
      users: response?.data?.users ?? [],
      user_name: response?.data?.user_name ?? '',
      err_cam: response?.data?.errs?.err_cam ?? [],
      err_orders: response?.data?.errs?.orders ?? [],
    });

    useGlobalStore.getState().setSpinner(false);
    return true;
  },

  // показ модалки ошибки по камерам/заказам
  showModalErrCam(is_show: boolean, err?: GraphErrCam | null): void {
    Analytics.log(
      is_show
        ? AnalyticsEvent.GraphErrCamModalOpen
        : AnalyticsEvent.GraphErrCamModalClose,
      is_show
        ? 'Открытие модалки ошибки по камерам'
        : 'Закрытие модалки ошибки по камерам',
    );
    set({
      isShowModalErrCam: is_show,
      modalErrCam: err,
    });
  },

  // показ модалки ошибки по заказам
  showModalErrOrder(is_show: boolean, err?: GraphErrOrder | null): void {
    Analytics.log(
      is_show
        ? AnalyticsEvent.GraphErrOrderModalOpen
        : AnalyticsEvent.GraphErrOrderModalClose,
      is_show
        ? 'Открытие модалки ошибки по заказу'
        : 'Закрытие модалки ошибки по заказу',
    );
    set({
      isShowModalErrOrder: is_show,
      modalErrOrder: err,
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
      Analytics.log(
        AnalyticsEvent.GraphErrOrderAnswerFail,
        'Обжалование (график работ): ошибка отправки',
      );
      useGlobalStore.getState().showModalText(true, res?.text);
    } else {
      Analytics.log(
        AnalyticsEvent.GraphErrOrderAnswerSuccess,
        'Обжалование (график работ): отправлено',
      );
      get().showModalErrOrder(false);
      get().getGraph();
    }

    setTimeout(() => {
      set({isClick: false});
    }, 300);
  },

  getStatistics: async (date_start: string, date_end: string) => {
    if (isAppOffline()) return true;

    const token = await useGlobalStore.getState().getAuthToken();

    const requestId = ++statisticsRequestId;
    if (get().statArr.length === 0) useGlobalStore.getState().setSpinner(true);

    const data = {
      type: 'show_data',
      token,
      date_start,
      date_end,
      ...(useSettingsStore.getState().point_id
        ? {point_id: useSettingsStore.getState().point_id}
        : {}),
    };

    const json = await api<StatResponse>('stat_time', data);

    if (requestId !== statisticsRequestId || isAppOffline()) {
      useGlobalStore.getState().setSpinner(false);
      return true;
    }

    if (json.st === false) {
      useGlobalStore.getState().setSpinner(false);
      return !json.retryable;
    }

    set({
      statArr: json?.data?.avg_orders ?? [],
    });

    useGlobalStore.getState().setSpinner(false);
    return true;
  },

  getAvgTime: async () => {
    if (isAppOffline()) return;

    const token = await useGlobalStore.getState().getAuthToken();
    const pointId = useSettingsStore.getState().point_id;

    if (token.length == 0) {
      return;
    }

    const data = {
      type: 'get_my_avg_time',
      token,
      ...(pointId ? {point_id: pointId} : {}),
    };

    const json = await api<string>('orders', data);

    if (json.st === false) {
      return;
    }

    if (useSettingsStore.getState().point_id === pointId) {
      useGlobalStore.getState().setAvgTime(json.text);
    }
  },
}));
