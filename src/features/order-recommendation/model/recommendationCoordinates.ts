import type {RecommendationCoordinates} from './orderRecommendation.types'

export function toRecommendationCoordinates(
  latitude: unknown,
  longitude: unknown,
): RecommendationCoordinates | null {
  if (
    latitude === null ||
    latitude === undefined ||
    latitude === '' ||
    longitude === null ||
    longitude === undefined ||
    longitude === ''
  ) {
    return null
  }

  const lat = Number(latitude)
  const lon = Number(longitude)

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180 ||
    (lat === 0 && lon === 0)
  ) {
    return null
  }

  return {lat, lon}
}
