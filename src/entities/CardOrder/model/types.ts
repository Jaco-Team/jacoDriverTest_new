import { Order } from '@/shared/store/OrdersStoreType'

export interface CardTagType {
  text: string,
  color: 'blue' | 'red' | 'purpur' | 'green',
  count?: number,
  globalFontSize: number
}

export interface CardTagPopoverType extends CardTagType{
  array: Array<CardTagPopoverArrType>
}

export interface CardTagPopoverArrType {
  names: string
}

export type setActiveConfirmProps = (
  active: boolean, 
  order_id?: number, 
  type_confirm?: typeConfirm, 
  order_confirm_is_delete?: boolean
) => void

export interface OrderActionsProps {
  item: Order
  dialCall: (phone: string) => void
  setActiveConfirm: setActiveConfirmProps,
  actionButtonOrder: (type: number, order_id: number) => void
  globalFontSize: number
}

export interface CardOrderProps {
  item: Order, 
  FormatPrice: (price: number) => string, 
  showAlertText: (is_open: boolean, text?: string) => void, 
  globalFontSize: number,
  dialCall: (number: string) => void,
  actionButtonOrder: (type: number, order_id: number) => void
  setActiveConfirm: setActiveConfirmProps,
}

export interface CommentTextProps {
  comment: string,
  showAlertText: (is_open: boolean, text?: string) => void
  globalFontSize: number,
  dialCall: (number: string) => void
}

type typeConfirm = ''|'fake'|'finish'|'cancel';

interface ItemProps {
  pd: string;
  et: string;
  kv: string;
}

export interface PdEtKvProps {
  item: ItemProps;
  textStyle: object;
}