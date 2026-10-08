const ORDER_MAP_LOCATION_PRECISION = 5;

type OrderWithMapLocation = {
  xy?: {
    lat?: unknown;
    lon?: unknown;
  } | null;
};

export function getOrderMapLocationKey(
  order: OrderWithMapLocation,
): string | null {
  const latitude = order.xy?.lat;
  const longitude = order.xy?.lon;

  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return `${latitude.toFixed(ORDER_MAP_LOCATION_PRECISION)}:${longitude.toFixed(ORDER_MAP_LOCATION_PRECISION)}`;
}
