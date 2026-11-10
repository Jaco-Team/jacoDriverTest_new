import {create} from 'zustand';
import Geolocation from '@react-native-community/geolocation';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {Platform} from 'react-native';
import {api} from './api';
import {isAppOffline} from '@/shared/lib/connectivityState';
import {GEOStore} from './GEOStoreType';
import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';
import {
  DRIVER_LOCATION_FIRST_TIMEOUT_MS,
  DRIVER_LOCATION_RETRY_TIMEOUT_MS,
  ExtendedGeolocationResponse,
  getDriverLocationErrorText,
  isLocationPermissionError,
  requestCurrentPosition,
} from './geolocation';
import {useGlobalStore} from './globalStore';
import {useOrdersStore} from './ordersStore';

export const useGEOStore = create<GEOStore>()((set, get) => ({
  check_pos_check: false,
  driver_location_requesting: false,
  //driver_need_gps: false,
  driver_pos: '',
  driver_pos_accuracy: 0,
  driver_pos_latitude: 0,
  driver_pos_longitude: 0,

  location_driver: null,
  location_driver_time_text: '',

  type_location: 'none',
  id_watch: null,

  location_wait: null,

  check_pos: async (func, data, is_show_error = true, onFailure, continueWithoutPosition = false) => {
    const stop = (text: string) => {
      if (is_show_error) {
        useGlobalStore.getState().showModalText(true, text);
      }

      onFailure?.();

      setTimeout(() => {
        useGlobalStore.getState().setSpinner(false);
      }, 300);
    };

    const granted = await get().getLocationPermissions();

    if (!granted) {
      stop('Вы запретили отслеживание геолокации');
      return;
    }

    // Как на сайте: 15 секунд точный GPS, затем 10 секунд грубая позиция.
    // Курьер видит отсчёт, только если ожидание закончится продолжением действия.
    const markWait = (timeoutMs: number) => {
      if (continueWithoutPosition) {
        const now = Date.now();
        set(state => ({location_wait: {
          deadlineAt: now + timeoutMs,
          startedAt: now,
          firstStartedAt: state.location_wait?.firstStartedAt ?? now,
        }}));
      }
    };

    let position: ExtendedGeolocationResponse | null = null;

    try {
      markWait(DRIVER_LOCATION_FIRST_TIMEOUT_MS + DRIVER_LOCATION_RETRY_TIMEOUT_MS);
      try {
        position = await requestCurrentPosition({
          enableHighAccuracy: true,
          timeout: DRIVER_LOCATION_FIRST_TIMEOUT_MS,
          maximumAge: 0,
        });
      } catch (firstError) {
        if (isLocationPermissionError(firstError)) {
          stop(getDriverLocationErrorText(firstError));
          return;
        }

        try {
          markWait(DRIVER_LOCATION_RETRY_TIMEOUT_MS);
          position = await requestCurrentPosition({
            enableHighAccuracy: false,
            timeout: DRIVER_LOCATION_RETRY_TIMEOUT_MS,
            maximumAge: 60000,
          });
        } catch (retryError) {
          if (isLocationPermissionError(retryError) || !continueWithoutPosition) {
            stop(getDriverLocationErrorText(retryError));
            return;
          }
        }
      }
    } finally {
      if (continueWithoutPosition) set({location_wait: null});
    }

    if (position === null) {
      // Позиция так и не пришла: продолжаем без неё, как check_pos_fake.
      func({latitude: 0, longitude: 0, data, accuracy: 0});
      return;
    }

    if (position.mocked) {
      stop('Не удалось определить местоположение. Возможно, данные были подменены.');
      return;
    }

    const {latitude, longitude, accuracy} = position.coords;
    func({latitude, longitude, data, accuracy});
  },

  check_pos_fake: (func, data, is_show_error = true) => {
    const latitude = 0;
    const longitude = 0;
    const accuracy = 0;

    func({latitude, longitude, data, accuracy});

    setTimeout(() => {
      useGlobalStore.getState().setSpinner(false);
    }, 300);
  },

  checkMyPos: () => {
    if (useOrdersStore.getState().driver_need_gps) {
      return;
    }

    if (!get().check_pos_check) {
      set({
        check_pos_check: true,
      });
    } else {
      return;
    }

    get().check_pos(get().saveMyPos, {}, false);

    setTimeout(() => {
      set({
        check_pos_check: false,
      });
    }, 1000);
  },

  saveMyPos: async ({latitude, longitude}) => {
    if (isAppOffline()) return;

    const token = await useGlobalStore.getState().getAuthToken();

    if (token && token.length > 0) {
      const data = {
        token: token,
        type: 'save_my_pos',
        latitude,
        longitude,
      };

      await api('settings', data);
    }
  },

  setDriverPos: async ({latitude, longitude}) => {
    let now = new Date();
    let min = now.getMinutes();

    set({
      location_driver: {lon: longitude, lat: latitude},
      location_driver_time_text:
        now.getHours() + ':' + (min < 10 ? '0' + min : min),
    });

    useGlobalStore.getState().setSpinner(false);
  },

  // показать текущее местоположение водителя
  showLocationDriver: async () => {
    if (get().driver_location_requesting) return false;

    Analytics.log(
      AnalyticsEvent.DriverLocation,
      'Показать текущее местоположение водителя на карте',
    );

    useGlobalStore.getState().setSpinner(true);

    set({
      driver_location_requesting: true,
      location_driver: null,
      location_driver_time_text: '',
    });

    try {
      const granted = await get().getLocationPermissions();

      if (!granted) {
        useGlobalStore
          .getState()
          .showModalText(
            true,
            'Нет доступа к геолокации. Разрешите доступ к местоположению в настройках телефона.',
          );
        return false;
      }

      let position: ExtendedGeolocationResponse;
      const startWait = (timeoutMs: number) => {
        const now = Date.now();
        set(state => ({location_wait: {
          deadlineAt: now + timeoutMs,
          startedAt: now,
          firstStartedAt: state.location_wait?.firstStartedAt ?? now,
        }}));
      };

      try {
        startWait(DRIVER_LOCATION_FIRST_TIMEOUT_MS + DRIVER_LOCATION_RETRY_TIMEOUT_MS);
        position = await requestCurrentPosition({
          enableHighAccuracy: true,
          timeout: DRIVER_LOCATION_FIRST_TIMEOUT_MS,
          maximumAge: 0,
        });
      } catch (firstError) {
        if (isLocationPermissionError(firstError)) throw firstError;

        startWait(DRIVER_LOCATION_RETRY_TIMEOUT_MS);
        position = await requestCurrentPosition({
          enableHighAccuracy: false,
          timeout: DRIVER_LOCATION_RETRY_TIMEOUT_MS,
          maximumAge: 60000,
        });
      }

      if (position.mocked) {
        useGlobalStore
          .getState()
          .showModalText(
            true,
            'Не удалось определить местоположение. Возможно, данные были подменены.',
          );
        return false;
      }

      await get().setDriverPos(position.coords);
      return true;
    } catch (error) {
      useGlobalStore
        .getState()
        .showModalText(true, getDriverLocationErrorText(error));
      return false;
    } finally {
      set({driver_location_requesting: false, location_wait: null});
      useGlobalStore.getState().setSpinner(false);
    }
  },

  set_type_location: async () => {
    const type_location = get().type_location;

    if (type_location === 'none') {
      const didFindLocation = await get().showLocationDriver();

      if (!didFindLocation || get().type_location !== 'none') return;

      set({
        type_location: 'location',
      });

      setTimeout(() => {
        if (get().type_location === 'location') {
          set({
            type_location: 'none',
            location_driver: null,
            location_driver_time_text: '',
          });
        }
      }, 30000);

      return;
    }

    if (type_location === 'location') {
      get().MyCurrentLocation();

      set({
        type_location: 'watch',
      });

      return;
    }

    if (type_location === 'watch') {
      const id_watch = get().id_watch;

      set({
        type_location: 'none',
        location_driver: null,
        location_driver_time_text: '',
      });

      if (id_watch) {
        Geolocation.clearWatch(id_watch);

        setTimeout(() => {
          set({
            id_watch: null,
          });
        }, 300);
      }

      return;
    }
  },

  MyCurrentLocation: async () => {
    try {
      const granted = await get().getLocationPermissions();

      if (granted) {
        const id_watch = Geolocation.watchPosition(
          ({coords, mocked}: ExtendedGeolocationResponse) => {
            if (!mocked) {
              const {latitude, longitude, accuracy} = coords;

              let now = new Date();
              let min = now.getMinutes();

              set({
                location_driver: {
                  lon: longitude,
                  lat: latitude,
                  accuracy: accuracy,
                },
                location_driver_time_text:
                  now.getHours() + ':' + (min < 10 ? '0' + min : min),
              });

              // setTimeout(() => {
              //   const type_location = get().type_location;

              //   if(type_location === 'none') {
              //     set({
              //       type_location: 'watch',
              //     })
              //   }
              // }, 100);
            }
          },
          ({message}) => {},
          {
            maximumAge: 3000,
            enableHighAccuracy: true,
            timeout: 10000,
          },
        );

        set({id_watch});
      }
    } catch (err) {}
  },

  getLocationPermissions: async () => {
    const granted = await request(
      Platform.select({
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      })!,
      {
        title: 'Жако Курьер',
        message: 'Геолокация нужна в момент завершения заказа',
        buttonPositive: 'OK',
      },
    );
    return granted === RESULTS.GRANTED;
  },
}));
