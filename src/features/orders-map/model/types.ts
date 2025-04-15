import { Theme, XY } from '@/shared/types/globalTypes'
import { Order } from '@/shared/store/OrdersStoreType'

export interface MapPointProps {
  theme: Theme, 
  item: Order, 
  showOrdersMap: (id: number) => void, 
  mapScale: number, 
  globalFontSize: number,
}

export interface MapPointHouse {
  point: XY,
  getHome: () => void
}