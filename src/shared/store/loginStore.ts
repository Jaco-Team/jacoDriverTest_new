import {create} from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import {
  exchangeLaravelSsoLoginCode,
  fetchLaravelMe,
  loginWithLaravel,
  logoutFromLaravel,
  requestLaravelSsoLoginBinding,
} from '@/shared/api/laravel/auth';
import {buildLaravelSsoLoginUrl} from '@/shared/api/laravel/config';
import {getLaravelApiErrorInfo} from '@/shared/api/laravel/errors';
import {
  clearLaravelAuthToken,
  getLaravelAuthToken,
  saveLaravelAuthToken,
} from '@/shared/lib/laravelAuthTokenStorage';
import {
  clearSsoLoginAttempt,
  readSsoLoginAttempt,
  saveSsoLoginAttempt,
} from '@/shared/lib/ssoLoginAttemptStorage';
import {
  createOfflineUser,
  getDriverOfflineOwner,
  getDriverOfflineOwnerKey,
  isDriverOfflineOwnerMatch,
  readDriverOfflineCacheDetailed,
} from '@/shared/lib/driverOfflineCache';
import {
  codePushReadiness,
  type CodePushRestoreOutcome,
} from '@/codePush/readiness';
import {useAppThemeStore} from '@/shared/theme/AppThemeProvider';
import {StatusTextType, LoginTypes, SsoLoginStart} from './LoginStoreType';
import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';
import {
  applyDriverSessionUser,
  clearDriverOfflineState,
  hydrateDriverOfflineState,
  restoreDriverOfflineStateForUser,
} from './driverOfflineState';
import {useGlobalStore} from './globalStore';
import {useOrdersStore} from './ordersStore';
import {useSettingsStore} from './settingsStore';

const SSO_ATTEMPT_MISSING_TEXT = 'Сессия SSO устарела. Начните вход ещё раз.';

export const useLoginStore = create<LoginTypes>()((set, get) => ({
  is_load: false,
  is_loadToken: false,

  authData: {isAuth: false, token: ''},
  currentUser: null,

  initialPage: '',
  loginErr: '',

  wallpaper_btn: false,
  formAuth: true,

  auth: async (
    login: string,
    pwd: string,
    captchaToken: string = '',
  ): Promise<StatusTextType> => {
    if (!get().is_load) {
      set({is_load: true});
    } else {
      return {st: false, text: 'Пожалуйста, подождите...'};
    }

    useGlobalStore.getState().setSpinner(true);

    let result: StatusTextType;

    try {
      const laravelSession = await loginWithLaravel(login, pwd, captchaToken);
      await saveLaravelAuthToken(laravelSession.token);
      await useGlobalStore.getState().setTokenAuth(laravelSession.token);
      const currentUser = await fetchLaravelMe(laravelSession.token);
      await applyDriverSessionUser(currentUser);

      await restoreDriverOfflineStateForUser(currentUser);
      await useSettingsStore.getState().getSettings();
      result = {st: true, text: ''};
    } catch (error) {
      await Promise.all([
        clearLaravelAuthToken().catch(() => undefined),
        useGlobalStore
          .getState()
          .setTokenAuth('')
          .catch(() => undefined),
      ]);
      set({currentUser: null});
      useAppThemeStore.getState().clearOwner();

      const errorInfo = getLaravelApiErrorInfo(error);
      result = {
        st: false,
        text: errorInfo.message,
        captcha_required: errorInfo.captchaRequired,
      };
    }

    setTimeout(() => {
      set({is_load: false});
      useGlobalStore.getState().setSpinner(false);
    }, 500);

    return result;
  },

  // Перед открытием входа приложение привязывает будущий код входа к себе:
  // challenge уходит в адрес для браузера, verifier остаётся в Keychain. Ссылку с
  // кодом может перехватить чужое приложение, но без verifier обменять код нельзя.
  prepareSsoLogin: async (): Promise<SsoLoginStart> => {
    try {
      const binding = await requestLaravelSsoLoginBinding();
      await saveSsoLoginAttempt(binding.codeVerifier);

      return {st: true, url: buildLaravelSsoLoginUrl(binding.codeChallenge)};
    } catch (error) {
      return {st: false, text: getLaravelApiErrorInfo(error).message};
    }
  },

  authWithSsoCode: async (loginCode: string): Promise<StatusTextType> => {
    if (get().is_load) {
      return {st: false, text: 'Пожалуйста, подождите...'};
    }

    // Код входа принимаем только для входа, который начало само приложение.
    const codeVerifier = await readSsoLoginAttempt().catch(() => '');

    if (!codeVerifier) {
      return {st: false, text: SSO_ATTEMPT_MISSING_TEXT};
    }

    set({is_load: true});
    useGlobalStore.getState().setSpinner(true);

    let result: StatusTextType;

    try {
      const laravelSession = await exchangeLaravelSsoLoginCode(loginCode, codeVerifier);
      // Попытка использована. При ошибке обмена verifier остаётся: настоящая
      // ссылка с кодом ещё может прийти после чужой или повторной.
      await clearSsoLoginAttempt().catch(() => undefined);
      await saveLaravelAuthToken(laravelSession.token);
      await useGlobalStore.getState().setTokenAuth(laravelSession.token);
      const currentUser = await fetchLaravelMe(laravelSession.token);
      await applyDriverSessionUser(currentUser);

      await restoreDriverOfflineStateForUser(currentUser);
      await useSettingsStore.getState().getSettings();
      result = {st: true, text: ''};
    } catch (error) {
      await Promise.all([
        clearLaravelAuthToken().catch(() => undefined),
        useGlobalStore
          .getState()
          .setTokenAuth('')
          .catch(() => undefined),
      ]);
      set({currentUser: null});
      useAppThemeStore.getState().clearOwner();

      result = {
        st: false,
        text: getLaravelApiErrorInfo(error).message,
      };
    }

    setTimeout(() => {
      set({is_load: false});
      useGlobalStore.getState().setSpinner(false);
    }, 500);

    return result;
  },

  check_token: async () => {
    const restoreEpoch = codePushReadiness.beginRestore();
    let restoreOutcome: CodePushRestoreOutcome = 'error';
    try {
      let laravelToken = '';

      try {
        laravelToken = await getLaravelAuthToken();
      } catch {
        // Secure storage can be temporarily unavailable (for example, in an
        // unsigned iOS simulator build). Startup must still leave Greeting.
        await useGlobalStore
          .getState()
          .setTokenAuth('')
          .catch(() => undefined);
        useGlobalStore.getState().setSpinner(false);
        useGlobalStore.getState().setSpinnerHidden(false);
        set({currentUser: null, is_load: false});
        useAppThemeStore.getState().clearOwner();
        return false;
      }

      const offlineRead = await readDriverOfflineCacheDetailed();
      const localCacheReadable = offlineRead.status === 'ready' || offlineRead.status === 'missing';

      if (!laravelToken) {
        set({currentUser: null, is_load: false});
        useAppThemeStore.getState().clearOwner();
        await Promise.all([
          clearLaravelAuthToken().catch(() => undefined),
          useGlobalStore
            .getState()
            .setTokenAuth('')
            .catch(() => undefined),
          clearDriverOfflineState(),
        ]);
        useGlobalStore.getState().setSpinner(false);
        useGlobalStore.getState().setSpinnerHidden(false);
        restoreOutcome = localCacheReadable ? 'auth-screen' : 'error';
        return false;
      }

      const offlineCache = offlineRead.status === 'ready' ? offlineRead.cache : null;

      const restoreOfflineSession = async () => {
        if (!offlineCache) return false;

        set({currentUser: createOfflineUser(offlineCache.owner)});
        await useGlobalStore.getState().setTokenAuth(laravelToken);
        await useAppThemeStore.getState().hydrateForOwner(getDriverOfflineOwnerKey(offlineCache.owner));
        await hydrateDriverOfflineState(offlineCache);
        useGlobalStore.getState().setSpinner(false);
        useGlobalStore.getState().setSpinnerHidden(false);
        set({is_load: false});
        restoreOutcome = 'authenticated';
        return true;
      };

      if (offlineCache) {
        const networkState = await NetInfo.fetch().catch(() => null);
        if (
          networkState?.isConnected === false ||
          networkState?.isInternetReachable === false
        ) {
          return restoreOfflineSession();
        }
      }

      try {
        const currentUser = await fetchLaravelMe(laravelToken);
        const accountChanged = await applyDriverSessionUser(currentUser);
        await useAppThemeStore.getState().hydrateForOwner(getDriverOfflineOwnerKey(getDriverOfflineOwner(currentUser)));

        if (offlineCache && !accountChanged) {
          if (isDriverOfflineOwnerMatch(offlineCache.owner, currentUser)) {
            await hydrateDriverOfflineState(offlineCache);
          } else {
            await clearDriverOfflineState();
          }
        }
      } catch (error) {
        const errorInfo = getLaravelApiErrorInfo(error);

        if (errorInfo.status === null && offlineCache) {
          return restoreOfflineSession();
        }

        if (errorInfo.status === 401) {
          await Promise.all([
            clearLaravelAuthToken(),
            useGlobalStore.getState().setTokenAuth(''),
            clearDriverOfflineState(),
          ]);
        }

        useGlobalStore.getState().setSpinner(false);
        useGlobalStore.getState().setSpinnerHidden(false);
        set({currentUser: null, is_load: false});
        useAppThemeStore.getState().clearOwner();

        restoreOutcome = localCacheReadable ? 'auth-screen' : 'error';
        return false;
      }

      await useGlobalStore.getState().setTokenAuth(laravelToken);
      await useSettingsStore.getState().getSettings();
      restoreOutcome = localCacheReadable ? 'authenticated' : 'error';
      return true;
    } finally {
      codePushReadiness.finishRestore(restoreEpoch, restoreOutcome);
    }
  },

  logogout: async () => {
    // метрика выхода
    Analytics.log(AnalyticsEvent.DrawerLogout, 'Выход из аккаунта');

    const laravelToken = await getLaravelAuthToken();
    set({currentUser: null});
    useOrdersStore.setState({del_orders: [], isHidingDelOrders: false});
    useAppThemeStore.getState().clearOwner();

    await Promise.all([
      clearLaravelAuthToken(),
      useGlobalStore.getState().setTokenAuth(''),
      clearDriverOfflineState(),
    ]);
    if (laravelToken) {
      void logoutFromLaravel(laravelToken).catch(() => undefined);
    }
  },
}));
