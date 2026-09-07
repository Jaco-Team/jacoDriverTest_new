export interface MapPoint {
  lat: number
  lon: number
}

export function isValidMapPoint(point: unknown): point is MapPoint {
  if (!point || typeof point !== 'object') return false

  const { lat, lon } = point as Partial<MapPoint>

  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lon === 'number' &&
    Number.isFinite(lon) &&
    lon >= -180 &&
    lon <= 180
  )
}
