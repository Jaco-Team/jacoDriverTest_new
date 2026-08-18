jest.unmock('@/analytics/AppMetricaService');

jest.mock('@appmetrica/react-native-analytics', () => {
  const api = {
    activate: jest.fn(),
    reportError: jest.fn(),
    reportUnhandledException: jest.fn(),
    reportEvent: jest.fn(),
    sendEventsBuffer: jest.fn(),
    putErrorEnvironmentValue: jest.fn(),
  };
  return { __esModule: true, default: api };
});

import AppMetrica from '@appmetrica/react-native-analytics';
import {
  Analytics,
  installJsCrashHandler,
  reportSentryEventToAppMetrica,
  resetAppMetricaServiceForTests,
  resetJsCrashHandler,
} from '@/analytics/AppMetricaService';

describe('AppMetrica error reporting', () => {
  const originalErrorUtils = (globalThis as { ErrorUtils?: unknown }).ErrorUtils;
  const originalUnhandled = (globalThis as { onunhandledrejection?: unknown }).onunhandledrejection;

  beforeEach(() => {
    resetJsCrashHandler();
    resetAppMetricaServiceForTests();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetJsCrashHandler();
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = originalErrorUtils;
    (globalThis as { onunhandledrejection?: unknown }).onunhandledrejection = originalUnhandled;
  });

  it('включает crash reporting и шлёт ошибку с identifier, а не одной простынёй', () => {
    const err = new Error('map failed');
    Analytics.reportError('OrdersFetchFail', err, { city: 'sochi' });

    expect(AppMetrica.activate).toHaveBeenCalledWith(
      expect.objectContaining({
        appVersion: '4.0',
        crashReporting: true,
        nativeCrashReporting: true,
      }),
    );
    expect(AppMetrica.reportError).toHaveBeenCalledWith(
      'OrdersFetchFail',
      expect.stringContaining('map failed'),
      err,
    );
    expect(AppMetrica.sendEventsBuffer).toHaveBeenCalled();
    expect(AppMetrica.reportUnhandledException).not.toHaveBeenCalled();
  });

  it('фатальную ошибку дублирует в unhandled exception и сбрасывает буфер', () => {
    const err = new Error('boom');
    Analytics.reportError('JSFatal', err, { isFatal: true }, { fatal: true });

    expect(AppMetrica.reportError).toHaveBeenCalledWith('JSFatal', expect.any(String), err);
    expect(AppMetrica.reportUnhandledException).toHaveBeenCalledWith(err);
    expect(AppMetrica.sendEventsBuffer).toHaveBeenCalled();
  });

  it('не отправляет одну и ту же ошибку дважды', () => {
    const err = new Error('dup');
    Analytics.reportError('JSError', err);
    Analytics.reportError('Sentry', err);
    expect(AppMetrica.reportError).toHaveBeenCalledTimes(1);
  });

  it('глобальный handler репортит и fatal, и не-fatal', () => {
    const passthrough = jest.fn();
    let installed: ((error: Error, isFatal?: boolean) => void) | undefined;
    (globalThis as {
      ErrorUtils?: {
        getGlobalHandler: () => typeof passthrough
        setGlobalHandler: (h: (error: Error, isFatal?: boolean) => void) => void
      }
    }).ErrorUtils = {
      getGlobalHandler: () => passthrough,
      setGlobalHandler: (handler) => {
        installed = handler;
      },
    };

    installJsCrashHandler();

    const fatal = new Error('fatal js');
    const nonFatal = new Error('soft js');
    installed?.(fatal, true);
    installed?.(nonFatal, false);

    expect(AppMetrica.reportError).toHaveBeenNthCalledWith(1, 'JSFatal', expect.any(String), fatal);
    expect(AppMetrica.reportUnhandledException).toHaveBeenCalledWith(fatal);
    expect(AppMetrica.reportError).toHaveBeenNthCalledWith(2, 'JSError', expect.any(String), nonFatal);
    expect(passthrough).toHaveBeenCalledTimes(2);
  });

  it('прокидывает событие Sentry в AppMetrica', () => {
    const err = new Error('from sentry');
    reportSentryEventToAppMetrica({ originalException: err }, { level: 'fatal', message: 'ignored' });
    expect(AppMetrica.reportError).toHaveBeenCalledWith(
      'Sentry',
      expect.stringContaining('from sentry'),
      err,
    );
  });

  it('пишет экран в error environment', () => {
    Analytics.setErrorContext('screen', 'Карта заказов');
    expect(AppMetrica.putErrorEnvironmentValue).toHaveBeenCalledWith('screen', 'Карта заказов');
  });
});
