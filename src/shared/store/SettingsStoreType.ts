import React from 'react';

import { Theme, DelType, ShowType } from '@/shared/types/globalTypes'

export interface SaveSettingsResponse {
  st: boolean,
  text?: string | null,
}

export interface MySettingsResponse {
  action_centered_map: number,
  color: string,
  fontSize: number,
  mapScale: number,
  theme: Theme,
  type_data_map: ShowType,
  type_show_del: DelType,
  update_interval: number,
  driver_avg_time: number|boolean,
  driver_page_stat_time: number|boolean,
  night_map: number,
  is_scaleMap: number
}

export interface MapPointType{
  theme: Theme;
  text?: string;
  isActive: boolean;
}

export interface MapPointTimeType extends MapPointType {
  value: ShowType,
  setActive: React.Dispatch<React.SetStateAction<ShowType>>
}

export interface MapPointThemeType extends MapPointType {
  value: Theme,
  setActive: React.Dispatch<React.SetStateAction<Theme>>
}

export type phoneType = {
  phone_center: string,
  phone_man: string,
  phone_upr: string
};

export interface getPhoneCafeResponse {
  phone: phoneType,
}

export interface SettingsStore extends MySettingsResponse {
  isClick: boolean,

  rotate_map: boolean,

  setRotateMap: (is_rotate: boolean) => void,

  getSettings: () => Promise<void>,

  saveSettings: (type_show_del: string, centered_map: string[], fontSize: number, update_interval: number, color: string, mapScale: number, groupTypeTime: string, theme: Theme, night_map: string[], is_scaleMap: string[]) => Promise<void>,
  getPhoneCafe: () => Promise<void>,
}