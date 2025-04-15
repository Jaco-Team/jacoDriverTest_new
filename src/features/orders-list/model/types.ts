import { Order } from '@/shared/store/OrdersStoreType'

type typeConfirm = ''|'fake'|'finish'|'cancel';

type setActiveConfirmProps = (
  active: boolean, 
  order_id?: number, 
  type_confirm?: typeConfirm, 
  order_confirm_is_delete?: boolean
) => void

export interface OrdersListProps {
  orders: Array<Order>,
  getOrders: (is_reload?: boolean) => Promise<void>,
  FormatPrice: (price: number) => string,
  showAlertText: (is_open: boolean, text?: string) => void, 
  globalFontSize: number,
  dialCall: (number: string) => void
  actionButtonOrder: (type: number, order_id: number) => void
  setActiveConfirm: setActiveConfirmProps,
}