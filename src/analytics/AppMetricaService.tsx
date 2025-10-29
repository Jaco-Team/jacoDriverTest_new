import AppMetrica, {AppMetricaConfig} from '@appmetrica/react-native-analytics';

const CONFIG: AppMetricaConfig = {
  apiKey: '3a2ee98f-b748-47d7-9222-39b2b71a7f24',
  appVersion: '1.0',
  sessionTimeout: 120,
  logs: true,
  locationTracking: false,
  statisticsSending: true,
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

class AppMetricaService {
  private initialized = false;

  /** Инициализируем SDK ровно один раз */
  init() {
    if (this.initialized) return;
    if ((globalThis as any).__appMetricaActivated) return;

    AppMetrica.activate(CONFIG);
    (globalThis as any).__appMetricaActivated = true;
    this.initialized = true;
  }

  /** Универсальный метод отправки события */
  log(type: AnalyticsEvent, event: string) {
    try {
      console.log('AnalyticsEvent [AppMetrica] reportEvent', event)
      AppMetrica.reportEvent(event);
    } catch (e) {
      console.error('[AppMetrica] reportEvent error', e);
    }
  }

  // Универсальная отправка ошибок (бизнес + ручные try/catch)
  reportError(name: string, error?: unknown, ctx?: Record<string, any>) {
    try {
      const err = error instanceof Error ? error : new Error(String(error ?? name));
      const title = `JSError: ${name}`;
      const parts: string[] = [];

      if (err.message) parts.push(String(err.message));
      if (err.stack) parts.push(String(err.stack));
      if (ctx) parts.push(`context=${safeJSONString(ctx)}`);

      const reason = parts.join('\n');

      console.log('[AppMetrica] reportError →', title, '\n', reason);

      AppMetrica.reportError(`${title}\n${reason}`);
      if (__DEV__) AppMetrica.sendEventsBuffer();
    } catch (e) {
      console.error('[AppMetrica] reportError failed:', e);
    }
  }

}

export const Analytics = new AppMetricaService();

/** Установка глобальных хендлеров JS-крашей и "тихих" промис-ошибок */
export function installJsCrashHandler() {
  if ((globalThis as any).__jsCrashHandlerInstalled) return;
  (globalThis as any).__jsCrashHandlerInstalled = true;

  console.log('[AppMetrica] Установка JS crash handler…');

  const prev = (global as any).ErrorUtils?.getGlobalHandler?.();

  (global as any).ErrorUtils?.setGlobalHandler?.((error: any, isFatal?: boolean) => {
    try {
      console.log('[AppMetrica] JS Global Error → isFatal:', !!isFatal, 'error:', error?.message ?? error);

      // ФАТАЛЬНЫЕ не репортим вручную — SDK сам отправляет
      if (!isFatal) {
        const parts: string[] = [];
        if (error?.message) parts.push(String(error.message));
        if (error?.stack) parts.push(String(error.stack));
        parts.push('isFatal=false');

        const payload = `JSError\n${parts.join('\n')}`;
        AppMetrica.reportError(payload);
        if (__DEV__) AppMetrica.sendEventsBuffer();
      }
    } catch (e) {
      console.error('[AppMetrica] JS Global Error report failed:', e);
    } finally {
      prev && prev(error, isFatal);
    }
  });

  const origUnhandled = (global as any).onunhandledrejection;
  (global as any).onunhandledrejection = (e: any) => {
    try {
      const err = e?.reason instanceof Error ? e.reason : new Error(String(e?.reason ?? 'UnhandledRejection'));
      const parts: string[] = [];
      if (err.message) parts.push(String(err.message));
      if (err.stack) parts.push(String(err.stack));

      const payload = `UnhandledPromiseRejection\n${parts.join('\n')}`;

      console.log('[AppMetrica] Unhandled Promise Rejection →', err.message);
      AppMetrica.reportError(payload);
      if (__DEV__) AppMetrica.sendEventsBuffer();
    } catch (ex) {
      console.error('[AppMetrica] UPR report failed:', ex);
    } finally {
      origUnhandled?.(e);
    }
  };
}
