import type {
  CameraPosition,
  Point,
  VisibleRegion,
} from 'react-native-yamap-plus';

import type {Order} from '@/shared/store/OrdersStoreType';
import {getOrderMapLocationKey} from '@/shared/lib/orderMapLocation';
import {isValidMapPoint} from './mapPoint';
import {getOrderMarkerColor} from './orderMarkerColor';

const SECTOR_COUNT = 8;
const INDICATOR_RADIUS_PERCENT = 43;

export interface MapViewport {
  center: Point;
  azimuth: number;
  region: VisibleRegion;
}

export interface OrderMapGroup {
  key: string;
  coordinate: Point;
  representative: Order;
  orders: Order[];
  count: number;
  statusColors: string[];
}

export interface MapEdgeIndicator extends OrderMapGroup {
  sector: number;
  angle: number;
  left: number;
  top: number;
}

export function getOrderUrgency(order: Order): number {
  const seconds = Number(order.to_time_sec);
  if (Number.isFinite(seconds)) return seconds;

  const minutes = Number(order.to_time_sec_min);
  return Number.isFinite(minutes) ? minutes * 60 : Number.POSITIVE_INFINITY;
}

function normalizeLongitudeDelta(delta: number): number {
  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
}

function projectPoint(point: Point, center: Point): {x: number; y: number} {
  const latitudeRadians = (center.lat * Math.PI) / 180;

  return {
    x:
      normalizeLongitudeDelta(point.lon - center.lon) *
      Math.cos(latitudeRadians),
    y: point.lat - center.lat,
  };
}

function isInsideVisibleRegion(point: Point, viewport: MapViewport): boolean {
  const polygon = [
    viewport.region.topLeft,
    viewport.region.topRight,
    viewport.region.bottomRight,
    viewport.region.bottomLeft,
  ].map(corner => projectPoint(corner, viewport.center));
  const projectedPoint = projectPoint(point, viewport.center);
  let sign = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const cross =
      (end.x - start.x) * (projectedPoint.y - start.y) -
      (end.y - start.y) * (projectedPoint.x - start.x);

    if (Math.abs(cross) < Number.EPSILON) continue;

    const currentSign = Math.sign(cross);
    if (sign !== 0 && currentSign !== sign) return false;
    sign = currentSign;
  }

  return true;
}

export function groupOrdersByMapLocation(
  orders: Order[],
  preferDriverColor = false,
): OrderMapGroup[] {
  const groups = new Map<string, OrderMapGroup>();

  for (const order of orders) {
    if (!isValidMapPoint(order.xy)) continue;

    const coordinate = {lat: order.xy.lat, lon: order.xy.lon};
    const key = getOrderMapLocationKey(order);

    if (!key) continue;
    const statusColor = getOrderMarkerColor(order, preferDriverColor);
    const existing = groups.get(key);

    if (existing) {
      existing.orders.push(order);
      existing.count += 1;
      if (getOrderUrgency(order) < getOrderUrgency(existing.representative)) {
        existing.representative = order;
      }
      existing.statusColors.push(statusColor);
      continue;
    }

    groups.set(key, {
      key,
      coordinate,
      representative: order,
      orders: [order],
      count: 1,
      statusColors: [statusColor],
    });
  }

  return Array.from(groups.values());
}

function getDirection(group: OrderMapGroup, viewport: MapViewport) {
  const projected = projectPoint(group.coordinate, viewport.center);
  const worldAngle = (Math.atan2(projected.x, projected.y) * 180) / Math.PI;
  const screenAngle = (worldAngle - viewport.azimuth + 360) % 360;
  const sector = Math.round(screenAngle / 45) % SECTOR_COUNT;
  const angle = sector * 45;
  const radians = (angle * Math.PI) / 180;

  return {
    sector,
    angle,
    left: 50 + Math.sin(radians) * INDICATOR_RADIUS_PERCENT,
    top: 50 - Math.cos(radians) * INDICATOR_RADIUS_PERCENT,
  };
}

export function getMapEdgeIndicators(
  orders: Order[],
  viewport: MapViewport | null,
  preferDriverColor = false,
): MapEdgeIndicator[] {
  if (!viewport) return [];

  const indicators = new Map<number, MapEdgeIndicator>();

  for (const group of groupOrdersByMapLocation(orders, preferDriverColor)) {
    if (isInsideVisibleRegion(group.coordinate, viewport)) continue;

    const direction = getDirection(group, viewport);
    const existing = indicators.get(direction.sector);

    if (existing) {
      existing.count += group.count;
      existing.statusColors.push(...group.statusColors);
      continue;
    }

    indicators.set(direction.sector, {
      ...group,
      ...direction,
    });
  }

  return Array.from(indicators.values()).sort(
    (left, right) => left.sector - right.sector,
  );
}

export function centerMapOnIndicator(
  map: {
    getCameraPosition: (callback: (position: CameraPosition) => void) => void;
    setCenter: (
      center: Point,
      zoom?: number,
      azimuth?: number,
      tilt?: number,
      duration?: number,
      animation?: number,
    ) => void;
  },
  coordinate: Point,
  animation: number,
): void {
  map.getCameraPosition(position => {
    map.setCenter(
      coordinate,
      position.zoom,
      position.azimuth,
      position.tilt,
      0.4,
      animation,
    );
  });
}
