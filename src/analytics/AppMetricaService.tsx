import AppMetrica, {AppMetricaConfig} from '@appmetrica/react-native-analytics';

const CONFIG: AppMetricaConfig = {
  apiKey: '3a2ee98f-b748-47d7-9222-39b2b71a7f24',
  appVersion: '4.0',
  sessionTimeout: 120,
  logs: false,
  locationTracking: false,
  statisticsSending: true,
  crashReporting: true,
  nativeCrashReporting: true,
  sessionsAutoTracking: true,
};

export enum AnalyticsEvent {
  /** Навигация */
  ScreenOpen = 'screen_open',

  /** Действия в боковом меню */
  DrawerCallDirector = 'call_director',
  DrawerCallManager = 'call_manager',
  DrawerCallContactCenter = 'call_contact_center',
  DrawerLogout = 'logout',

  /** Заказы */
  OrderCallClient = 'order_call_client',
  OrderClipboard = 'order_clipboard',
  OrderAccept = 'order_accept',
  OrderArrive = 'order_arrive',
  OrderComplete = 'order_complete',

  // Подтверждения
  ConfirmModalOpen = 'confirm_modal_open',
  ConfirmModalClose = 'confirm_modal_close',
  ConfirmApprove = 'confirm_approve',

  /** Авторизация */
  AuthLogin = 'auth_login',    
  AuthLoginFail = 'auth_login_fail', 
  AuthGoToResetPwd = 'auth_go_to_resetpwd',
  AuthSendSms = 'auth_send_sms',
  AuthSendSmsFail = 'auth_send_sms_fail',

  /** Обратная связь */
  FeedbackModalOpen = 'feedback_modal_open',
  FeedbackModalClose = 'feedback_modal_close',
  FeedbackCreate = 'feedback_create', 

  // Выбор типа заказа
  OrderSelect = 'order_select',

  // Работа с картой
  MapHomeCenter = 'map_home_center',
  DriverLocation = 'driver_location',
  MapRotateOn = 'map_rotate_on',
  MapRotateOff = 'map_rotate_off',
  OrderMapOpen = 'orders_map_open',
  OrderMapClose = 'orders_map_close',

  // Загрузка заказов
  OrdersFetchSuccess = 'orders_fetch_success',
  OrdersFetchFail = 'orders_fetch_fail',
  OrdersTypeDopModalOpen = 'orders_type_dop_modal_open',
  OrdersTypeDopModalClose = 'orders_type_dop_modal_close',

  // Cтраница Расчет открытие/закрытие календаря
  PriceStartCalendarOpen = 'price_start_calendar_open',
  PriceStartCalendarClose = 'price_start_calendar_close',
  PriceEndCalendarOpen = 'price_end_calendar_open',
  PriceEndCalendarClose = 'price_end_calendar_close',

  // Страница График открытие/закрытие выбора месяца
  GraphMonthPickerOpen = 'graph_month_picker_open',
  GraphMonthPickerClose = 'graph_month_picker_close',
  GraphMonthSelected = 'graph_month_selected',
  GraphErrCamModalOpen   = 'graph_errcam_modal_open',
  GraphErrCamModalClose  = 'graph_errcam_modal_close',
  GraphErrOrderModalOpen = 'graph_errorder_modal_open',
  GraphErrOrderModalClose= 'graph_errorder_modal_close',

  // Ответ на ошибку/обжалование ошибки по камерам/заказам
  GraphErrOrderAnswerSuccess = 'graph_error_answer_success',
  GraphErrOrderAnswerFail    = 'graph_error_answer_fail',

  // Сохранение настроек приложения
  SettingsSaveSuccess = 'settings_save_success',
  SettingsSaveFail = 'settings_save_fail',
  SystemSettingsOpen = 'system_settings_open',

  // Страница Статистика открытие/закрытие календаря
  StatisticsCalendarStartOpen = 'statistics_calendar_start_open',
  StatisticsCalendarEndOpen = 'statistics_calendar_end_open',
  StatisticsCalendarStartClose = 'statistics_calendar_start_close',
  StatisticsCalendarEndClose = 'statistics_calendar_end_close',
  StatisticsDateSelected = 'statistics_date_selected',
}

function safeJSONString(value: unknown): string {
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v as object)) return '[Circular]';
        seen.add(v as object);
      }
      return v;
    });
  } catch {
    return '[unserializable]';
  }
}

const reportedErrors = new WeakSet<object>();

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string' && error) {
    return new Error(error);
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String((error as { message?: unknown }).message ?? fallback));
  }
  return new Error(String(error ?? fallback));
}

function markReported(error: Error): boolean {
  if (reportedErrors.has(error)) {
    return true;
  }
  reportedErrors.add(error);
  return false;
}

class AppMetricaService {
  private initialized = false;

  /** Инициализируем SDK ровно один раз */
  init() {
    if (this.initialized) return;
    if ((globalThis as any).__appMetricaActivated) return;

    AppMetrica.activate(CONFIG);
    (globalThis as any).__appMetricaActivated = true;
    this.initialized = true;
    try {
      AppMetrica.putErrorEnvironmentValue('appVersion', CONFIG.appVersion);
    } catch {}
  }

  /** Универсальный метод отправки события */
  log(type: AnalyticsEvent, event: string) {
    try {
      this.init();
      AppMetrica.reportEvent(event);
    } catch (e) {
      console.error('[AppMetrica] reportEvent error', e);
    }
  }

  setErrorContext(key: string, value?: string) {
    try {
      this.init();
      AppMetrica.putErrorEnvironmentValue(key, value);
    } catch (e) {
      console.error('[AppMetrica] putErrorEnvironmentValue failed:', e);
    }
  }

  reportError(
    name: string,
    error?: unknown,
    ctx?: Record<string, any>,
    options?: { fatal?: boolean },
  ) {
    try {
      this.init();
      const err = toError(error, name);
      if (markReported(err)) {
        return;
      }

      const messageParts = [err.message || name];
      if (ctx) {
        messageParts.push(`context=${safeJSONString(ctx)}`);
      }
      const message = messageParts.join('\n');

      AppMetrica.reportError(name, message, err);
      if (options?.fatal) {
        AppMetrica.reportUnhandledException(err);
      }
      AppMetrica.sendEventsBuffer();
    } catch (e) {
      console.error('[AppMetrica] reportError failed:', e);
    }
  }

}

export const Analytics = new AppMetricaService();

export function resetAppMetricaServiceForTests() {
  (Analytics as unknown as { initialized: boolean }).initialized = false;
  (globalThis as { __appMetricaActivated?: boolean }).__appMetricaActivated = false;
}

type GlobalErrorHandler = (error: any, isFatal?: boolean) => void;

let previousGlobalHandler: GlobalErrorHandler | undefined;
let previousUnhandled: ((e: any) => void) | undefined;

/** Установка глобальных хендлеров JS-крашей и "тихих" промис-ошибок */
export function installJsCrashHandler() {
  if ((globalThis as any).__jsCrashHandlerInstalled) return;
  (globalThis as any).__jsCrashHandlerInstalled = true;

  Analytics.init();

  const errorUtils = (globalThis as any).ErrorUtils;
  previousGlobalHandler = errorUtils?.getGlobalHandler?.();

  errorUtils?.setGlobalHandler?.((error: any, isFatal?: boolean) => {
    try {
      Analytics.reportError(
        isFatal ? 'JSFatal' : 'JSError',
        error,
        { isFatal: !!isFatal },
        { fatal: !!isFatal },
      );
    } catch (e) {
      console.error('[AppMetrica] JS Global Error report failed:', e);
    } finally {
      previousGlobalHandler?.(error, isFatal);
    }
  });

  previousUnhandled = (globalThis as any).onunhandledrejection;
  (globalThis as any).onunhandledrejection = (e: any) => {
    try {
      const err = e?.reason instanceof Error ? e.reason : new Error(String(e?.reason ?? 'UnhandledRejection'));
      Analytics.reportError('UnhandledPromiseRejection', err);
    } catch (ex) {
      console.error('[AppMetrica] UPR report failed:', ex);
    } finally {
      previousUnhandled?.(e);
    }
  };
}

export function resetJsCrashHandler() {
  const errorUtils = (globalThis as any).ErrorUtils;
  if (previousGlobalHandler && errorUtils?.setGlobalHandler) {
    errorUtils.setGlobalHandler(previousGlobalHandler);
  }
  if (previousUnhandled !== undefined) {
    (globalThis as any).onunhandledrejection = previousUnhandled;
  }
  previousGlobalHandler = undefined;
  previousUnhandled = undefined;
  (globalThis as any).__jsCrashHandlerInstalled = false;
}

export function reportSentryEventToAppMetrica(hint?: { originalException?: unknown }, event?: { level?: string; message?: string }) {
  const original = hint?.originalException;
  Analytics.reportError('Sentry', original ?? (event?.message ? new Error(event.message) : undefined), {
    level: event?.level,
    source: 'sentry',
  });
}
