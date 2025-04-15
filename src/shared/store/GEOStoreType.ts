import { actionOrderData } from './OrdersStoreType'

export interface GEOStore {
  check_pos_check: boolean,
  //driver_need_gps: boolean,
  driver_pos: string,
  driver_pos_accuracy: number,
  driver_pos_latitude: number,
  driver_pos_longitude: number,

  location_driver: {lon: number, lat: number, accuracy?: number} | null,
  location_driver_time_text: string,

  type_location: 'none' | 'location' | 'watch',
  id_watch: number | null,

  check_pos: (func: any, data: actionOrderData|{}, is_show_error?: boolean) => void,
  check_pos_fake: (func: any, data: actionOrderData|{}, is_show_error?: boolean) => void,
  saveMyPos: ({latitude, longitude}: {latitude: number, longitude: number}) => void,
  setDriverPos: ({latitude, longitude}: {latitude: number, longitude: number}) => void,
  showLocationDriver: () => void,
  getLocationPermissions: () => Promise<boolean>,
  checkMyPos: () => void,
  MyCurrentLocation: () => void,
  set_type_location: () => void,
}