import Geolocation, {
  type GeolocationError,
  type GeolocationOptions,
  type GeolocationResponse,
} from '@react-native-community/geolocation';

export interface ExtendedGeolocationResponse extends GeolocationResponse {
  mocked?: boolean;
}

export const DRIVER_LOCATION_FIRST_TIMEOUT_MS = 15000;
export const DRIVER_LOCATION_RETRY_TIMEOUT_MS = 10000;

export function requestCurrentPosition(
  options: GeolocationOptions,
): Promise<ExtendedGeolocationResponse> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function isLocationPermissionError(error: unknown): boolean {
  const locationError = error as Partial<GeolocationError> | null;
  const message = String(locationError?.message ?? '').toLowerCase();

  return (
    locationError?.code === 1 ||
    message.includes('denied') ||
    message.includes('permission')
  );
}

export function getDriverLocationErrorText(error: unknown): string {
  const locationError = error as Partial<GeolocationError> | null;
  const message = String(locationError?.message ?? '').toLowerCase();

  if (isLocationPermissionError(error)) {
    return 'Нет доступа к геолокации. Разрешите доступ к местоположению в настройках телефона.';
  }

  if (locationError?.code === 3 || message.includes('timeout')) {
    return 'Местоположение определяется слишком долго. Проверьте GPS и интернет, затем повторите действие.';
  }

  return 'Не удалось определить местоположение. Включите GPS и выйдите на открытое место, затем повторите действие.';
}
