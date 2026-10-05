// Same city choices as jaco_driver_site. MapKit supplies native city packages;
// the website's tile bounds and zoom levels do not define these packages.
export const OFFLINE_MAP_CITIES = [
  {
    id: 'samara',
    name: 'Самара',
    center: {lat: 53.2, lon: 50.1},
    bounds: {west: 49.75, south: 53.0, east: 50.65, north: 53.48},
  },
  {
    id: 'tolyatti',
    name: 'Тольятти',
    center: {lat: 53.52, lon: 49.42},
    bounds: {west: 49.05, south: 53.38, east: 49.72, north: 53.74},
  },
] as const;

export type OfflineCityId = (typeof OFFLINE_MAP_CITIES)[number]['id'];

export function getOfflineMapCity(id: string) {
  return OFFLINE_MAP_CITIES.find(city => city.id === id);
}

export function findOfflineMapCity(point: {lat: number; lon: number}) {
  return OFFLINE_MAP_CITIES.find(
    ({bounds}) =>
      point.lat >= bounds.south &&
      point.lat <= bounds.north &&
      point.lon >= bounds.west &&
      point.lon <= bounds.east,
  );
}
