import { typeConfirm, XY } from '@/shared/types/globalTypes'

export type TypeOrder = {
  id: number, 
  text: string
}

type types_dop = {
  id: number,
  text: string
}

export interface OrdersStore {
  isClick: boolean,
  is_load: boolean,
  is_check: boolean,
  is_loadToken: boolean,

  type: TypeOrder,

  types: Array<TypeOrder>,

  limit_summ: string,
  limit_count: string,
  orders: Array<Order>,
  home: null|XY,

  update_interval: number,

  driver_need_gps: boolean,

  type_confirm: typeConfirm,
  order_confirm_id: number,
  is_modalConfirm: boolean,
  order_confirm_is_delete: boolean,

  showOrders: Array<Order>,
  isOpenOrderMap: boolean,

  types_dop: Array<types_dop>,
  type_dop: string[],
  is_showModalTypeDop: boolean,

  typeToStatus: Record<string, string>,

  showModalTypeDop: ( is_show: boolean ) => void,
  setTypeDop: (type: string[]) => void,

  filterOrdersByTypes: ( orders: Array<Order>, types: string[] ) => Array<Order>,

  getOrders: (is_reload?: boolean) => Promise<void>;
  selectType: (item: {id: number, text: string}) => void;
  setUpdateInterval: (interval: number) => void,
  actionButtonOrder: (type: number, order_id: number) => void,
  actionOrder: (params: actionOrderType) => Promise<void>,
  actionOrderFake: (params: actionOrderFakeType) => Promise<void>,
  setActiveConfirm: (active: boolean, order_id?: number, type_confirm?: typeConfirm, order_confirm_is_delete?: boolean) => void,
  showOrdersMap: (id: number) => void,
}

export interface GetOrdersResponse {
  orders: Array<Order>,
  update_interval: number,
  limit: string,
  limit_count: string,
  arr_del_list: Array<number>,
  driver_pay: number,
  home: XY,
  driver_need_gps: number,
}

export type Order = {
  addr: string,
  comment: string,
  count_drink: number,
  drink_list?: Array<{names: string}>,
  count_other: number,
  count_pasta: number,
  count_pizza: number,
  delete_reason: string|null,
  driver_id: number|null,
  driver_login: string|null,
  driver_name: string|null,
  et: string,
  pd: string,
  kv: string,

  fake_dom: number,
  give_data_time: string,
  id: number,
  id_text: string,
  is_delete: number,
  is_get: number,
  is_my: number,
  is_pred: number,
  is_ready: number,
  
  need_time: string,
  number: string,
  online_pay: number,

  color?: string,
  close_time_?: number,
  
  plus_time_pred: number,
  point_color: string,
  point_text: string,
  sdacha: number,
  status: string,
  status_order: number,
  sum_order: number,
  sum_sdacha: number|string,
  time: string,
  time_dev_order: number,
  time_start_mini: string,
  time_start_order: string,
  to_time: string,
  to_time_sec: number,
  to_time_sec_min: number,
  unix_date_time_preorder: number,
  unix_time: number,
  unix_time_to_client: number,
  unix_time_to_client_test: string,
  close_date_time_order?: string,
  xy: XY
}

export type actionOrderData = {
  order_id: number,
  type: number
}

export interface actionOrderType {
  data: actionOrderData;
  latitude?: string;
  longitude?: string;
}

export interface actionOrderFakeType {
  data: { order_id: number };
  latitude?: string;
  longitude?: string;
  accuracy?: number;
}