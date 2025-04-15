type PriceHistoryObject = {
  give: number,
  time: string
}

type AllDatesGraphType = {
  D: number,
  date: string,
  day: string,
  dow: string,
}

type UsersGraphType = {
  user_name?: string,
  day?: string,
  date?: string,
  min?: number,
  hours?: number,
}

type MounthGraphType = {
  day: string,
  is_active: 0 | 1,
  mounth: string,
}

type PriceObject = {
  cash_fiskal: number,
  count: number,
  count_bank: number,
  count_cash: number,
  date: string,
  drive: string,
  full_give: number,
  my_cash: number,
  my_dop_cash: number,
  my_price: number,
  name: string,
  sdacha: number,
  sdacha_old: number,
  sum: number,
  sum_bank: number,
  sum_cash: number
}

export type GraphErrCam = {
  date_time_close: string,
  date_time_fine: string,
  fine_name: string,
  id: number,
  imgs: string[],
  is_delete: boolean,
  is_edit: number,
  point_id: number,
  price: number,
  status: number,
  text_one: string,
  text_two: string
}

export type GraphErrOrder = {
  answer: string
  answer_date: string
  date_close: string
  date_time_close: string
  date_time_order: string
  err_id: number
  full_user_name: string
  id: number
  imgs: string[]
  is_delete: number
  is_edit: number
  is_mentor: number
  item_id: number
  item_name: string
  item_price: number
  my_price: number
  need_row: number
  new_order_id: number
  new_status: number
  new_text_1: string
  new_text_2: string
  order_desc: string
  order_id: number
  pr_id: number
  pr_name: string
  row_id: number
  stage_id: number
  stage_name: string
  user_id: number
  user_name: string
  win_id: number
  win_name: string
}

type GraphErr = {
  err_cam: Array<GraphErrCam>,
  orders: Array<GraphErrOrder>,
}

type AvgOrdersStatTimes = {
  count: number,
  label: string,
  percent: number
}

type AvgOrdersStat = {
  all_count: number,
  fake: number,
  fake_percent: number,
  false_dist: number,
  false_dist_percent: number,
  norm: number,
  norm_percent: number,
  time_dist_false: number,
  time_dist_false_percent: number,
  time_dist_true: number,
  time_dist_true_percent: number,
  true_dist: number,
  true_dist_percent: number
  type_times: Array<AvgOrdersStatTimes>
}

type AvgOrders = {
  driver_id: number,
  name: string,
  other_stat: AvgOrdersStat,
  time: number,
  time2: string
}

export interface StatResponse {
  avg_orders: Array<AvgOrders>;
}

export interface PriceResponse {
  give_hist: Array<PriceHistoryObject>;
  stat: PriceObject;
};

export interface statArr {
  statArr: Array<AvgOrders> | [],
}

import { ConfigType } from 'dayjs'

export interface StatTypes {
  isClick: boolean,

  dateGraph: string,

  statPrice: PriceObject | null,
  give_history: Array<PriceHistoryObject> | [],
  
  month_list: Array<MounthGraphType>,
  dates: Array<AllDatesGraphType>,
  users: Array<Array<UsersGraphType>>,
  user_name: string,
  err_cam: Array<GraphErrCam>,
  err_orders: Array<GraphErrOrder>,

  statArr: Array<AvgOrders> | [],

  isShowModalErrCam: boolean,
  modalErrCam: GraphErrCam | null,

  isShowModalErrOrder: boolean,
  modalErrOrder: GraphErrOrder | null,

  setGraphDate: (date: string) => void,
  FormatPrice: (price: number) => string,
  FormatDate: (date: ConfigType) => string,
  getStatPrice: (date: string) => Promise<void>,
  getGraph: (date?: string | null) => Promise<void>,
  showModalErrCam: (is_show: boolean, err?: GraphErrCam | null) => void,
  showModalErrOrder: (is_show: boolean, err?: GraphErrOrder | null) => void,
  answer_err_cam: (text: string, err_id: number) => void,
  answer_err_order: (text: string, err_id: number, row_id: number) => void,
  getStatistics: (date_start: string, date_end: string) => void,
  getAvgTime: () => void
}

export interface GraphResponse {
  all_dates: Array<AllDatesGraphType>,
  date: string,
  users: Array<Array<UsersGraphType>>
  mounth: Array<MounthGraphType>
  user_name: string,
  errs: GraphErr
}

export interface AnswerErrCamResponse {
  st: boolean,
  text?: string | null,
}