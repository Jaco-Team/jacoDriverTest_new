import {create} from 'zustand';
import {getLaravelAuthToken} from '@/shared/lib/laravelAuthTokenStorage';
import {normalizeGlobalFontSize} from '@/shared/lib/fontSize';
import {Theme} from '@/shared/types/globalTypes';
import {globalTypes} from './GlobalStoreType';
import {phoneType} from './SettingsStoreType';

export const useGlobalStore = create<globalTypes>()((set, get) => ({
  loadSpinner: false,
  loadSpinnerHidden: false,

  is_show_modal_text: false,
  is_show_alert_text: false,
  modal_text: '',
  alertSeverity: 'success',

  tokenAuth: '',

  globalFontSize: 16,
  theme: 'white',
  mapScale: 1,
  phones: null,

  // Как на сайте: пункты меню скрыты, пока настройки кафе их не включат.
  is_need_avg_time: false,
  is_need_page_stat: false,

  avgTime: '',

  notifToken: '',

  showModalText: (is_open: boolean, text?: string) => {
    set({is_show_modal_text: is_open, modal_text: text});
  },
  showAlertText: (is_open: boolean, text?: string, severity = 'success') => {
    set({is_show_alert_text: is_open, modal_text: text, alertSeverity: severity});
    if (is_open === true) {
      setTimeout(() => set({is_show_alert_text: false}), 5000);
    }
  },

  setSpinner: (status: boolean) => {
    set({loadSpinner: status});
  },
  setSpinnerHidden: (status: boolean) => {
    set({loadSpinnerHidden: status});
  },

  setTokenAuth: async (token: string) => {
    set({tokenAuth: token});
  },

  getTokenAuth: async (): Promise<string> => {
    return (await getLaravelAuthToken()) ?? '';
  },

  getAuthToken: async (): Promise<string> => {
    if (get().tokenAuth === '') {
      const token = await get().getTokenAuth();

      set({tokenAuth: token});

      return token;
    }

    return get().tokenAuth ?? '';
  },

  setFontSize: (size: number) => {
    set({globalFontSize: normalizeGlobalFontSize(size)});
  },
  setTheme: (theme: Theme) => {
    set({theme: theme});
  },
  setMapScale: (size: number) => {
    set({mapScale: size});
  },
  setPhone: (phones: phoneType | null) => {
    set({phones: phones});
  },
  setNeedAvgTime: (st: boolean) => {
    set({is_need_avg_time: st});
  },
  setNeedPageStat: (st: boolean) => {
    set({is_need_page_stat: st});
  },
  setAvgTime: (time: string) => {
    set({avgTime: time});
  },
  setNotifToken: (token: string) => {
    set({notifToken: token});
  },
}));
