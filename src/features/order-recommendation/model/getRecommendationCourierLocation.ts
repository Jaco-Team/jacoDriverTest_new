import Geolocation, {
  type GeolocationResponse,
} from '@react-native-community/geolocation'

import {useGEOStore} from '@/shared/store/store'

import type {RecommendationCoordinates} from './orderRecommendation.types'
import {toRecommendationCoordinates} from './recommendationCoordinates'

interface ExtendedGeolocationResponse extends GeolocationResponse {
  mocked?: boolean
}

export async function getRecommendationCourierLocation(): Promise<RecommendationCoordinates | null> {
  const cached = useGEOStore.getState().location_driver
  const cachedCoordinates = cached
    ? toRecommendationCoordinates(cached.lat, cached.lon)
    : null

  if (cachedCoordinates) return cachedCoordinates

  const granted = await useGEOStore.getState().getLocationPermissions().catch(() => false)
  if (!granted) return null

  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      ({coords, mocked}: ExtendedGeolocationResponse) => {
        resolve(mocked
          ? null
          : toRecommendationCoordinates(coords.latitude, coords.longitude))
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: 60000,
        timeout: 5000,
      },
    )
  })
}
