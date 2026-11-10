import { actionOrderData } from './OrdersStoreType'

export interface GEOStore {
  check_pos_check: boolean,
  driver_location_requesting: boolean,
  //driver_need_gps: boolean,
  driver_pos: string,
  driver_pos_accuracy: number,
  driver_pos_latitude: number,
  driver_pos_longitude: number,

  location_driver: {lon: number, lat: number, accuracy?: number} | null,
  location_driver_time_text: string,

  type_location: 'none' | 'location' | 'watch',
  id_watch: number | null,

  // Ожидание геопозиции, которое видит курьер: для обратного отсчёта на спиннере.
  // startedAt — начало текущей попытки, firstStartedAt — начало всего ожидания.
  location_wait: {deadlineAt: number, startedAt: number, firstStartedAt?: number} | null,

  // continueWithoutPosition: как на сайте, после двух неудачных попыток вызвать func с 0, 0.
  check_pos: (func: any, data: actionOrderData|{}, is_show_error?: boolean, onFailure?: () => void, continueWithoutPosition?: boolean) => void,
  check_pos_fake: (func: any, data: actionOrderData|{}, is_show_error?: boolean) => void,
  saveMyPos: ({latitude, longitude}: {latitude: number, longitude: number}) => void,
  setDriverPos: ({latitude, longitude}: {latitude: number, longitude: number}) => void,
  showLocationDriver: () => Promise<boolean>,
  getLocationPermissions: () => Promise<boolean>,
  checkMyPos: () => void,
  MyCurrentLocation: () => void,
  set_type_location: () => Promise<void>,
}
