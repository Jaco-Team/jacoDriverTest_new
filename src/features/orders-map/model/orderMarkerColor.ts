import type {Order} from '@/shared/store/OrdersStoreType';

const DEFAULT_MARKER_COLOR = '#42627D';

export function getOrderMarkerColor(
  order: Pick<Order, 'color' | 'point_color'>,
  preferDriverColor = false,
): string {
  const color = preferDriverColor
    ? order.color || order.point_color
    : order.point_color || order.color;

  return typeof color === 'string' && color.trim()
    ? color.trim()
    : DEFAULT_MARKER_COLOR;
}
