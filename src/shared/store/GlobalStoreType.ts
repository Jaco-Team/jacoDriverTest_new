import { phoneType } from './SettingsStoreType'

import { Theme } from '@/shared/types/globalTypes'

export interface globalTypes {
  globalFontSize: number,
  setFontSize: (size: number) => void,

  theme: Theme,
  setTheme: (theme: Theme) => void,

  mapScale: number,
  setMapScale: (size: number) => void,

  loadSpinner: boolean,
  setSpinner: (st: boolean) => void,

  is_show_modal_text: boolean,
  is_show_alert_text: boolean,
  modal_text: string,
  showModalText: (is_open: boolean, text?: string) => void,
  showAlertText: (is_open: boolean, text?: string) => void,

  tokenAuth: string,
  setTokenAuth: (token: string) => void,
  getTokenAuth: () => Promise<string>,
  getAuthToken: () => Promise<string>,

  phones: phoneType | null,
  setPhone: (phones: phoneType | null) => void,

  is_need_avg_time: boolean,
  is_need_page_stat: boolean,
  setNeedAvgTime: (is_need: boolean) => void,
  setNeedPageStat: (is_need: boolean) => void,

  avgTime: string,
  setAvgTime: (time: string) => void,

  notifToken: string,
  setNotifToken: (token: string) => void,

  loadSpinnerHidden: boolean,
  setSpinnerHidden: (st: boolean) => void,
}