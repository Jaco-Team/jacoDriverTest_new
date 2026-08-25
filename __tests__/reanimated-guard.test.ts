import * as Sentry from '@sentry/react-native';
import { Analytics } from '@/analytics/AppMetricaService';
import {
  getCurrentRouteName,
  installReanimatedGuard,
  isReanimatedError,
  reportReanimatedError,
  resetReanimatedGuard,
} from '@/shared/lib/reanimatedGuard';

function makeReanimatedError(message = '[Reanimated] worklet failed') {
  return Object.assign(new Error(message), {
    name: 'ReanimatedError',
    jsEngine: 'reanimated',
  });
}

describe('reanimatedGuard', () => {
  const originalErrorUtils = (globalThis as { ErrorUtils?: unknown }).ErrorUtils;

  afterEach(() => {
    resetReanimatedGuard();
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = originalErrorUtils;
    jest.clearAllMocks();
  });

  it('распознаёт ошибки UI-runtime Reanimated', () => {
    expect(isReanimatedError(makeReanimatedError())).toBe(true);
    expect(isReanimatedError({ jsEngine: 'reanimated', message: 'boom' })).toBe(true);
    expect(isReanimatedError('[Reanimated] shared value')).toBe(true);
    expect(isReanimatedError(new Error('network timeout'))).toBe(false);
    expect(isReanimatedError(null)).toBe(false);
  });

  it('отправляет worklet-ошибку в Sentry и AppMetrica', () => {
    reportReanimatedError(makeReanimatedError());

    expect(Analytics.reportError).toHaveBeenCalledWith(
      'ReanimatedWorklet',
      expect.any(Error),
      expect.objectContaining({ jsEngine: 'reanimated', route: 'unknown' }),
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: { jsEngine: 'reanimated' },
      }),
    );
  });

  it('перехватывает reportFatalError для worklet и пропускает остальные', () => {
    resetReanimatedGuard();
    const passthrough = jest.fn();
    (globalThis as { ErrorUtils?: { reportFatalError: typeof passthrough } }).ErrorUtils = {
      reportFatalError: passthrough,
    };

    installReanimatedGuard();

    const workletError = makeReanimatedError();
    const errorUtils = (
      globalThis as unknown as {
        ErrorUtils: { reportFatalError: (error: Error) => void };
      }
    ).ErrorUtils;
    errorUtils.reportFatalError(workletError);

    expect(passthrough).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();

    const other = new Error('native fatal');
    errorUtils.reportFatalError(other);
    expect(passthrough).toHaveBeenCalledWith(other);
  });

  it('не падает, если навигация ещё не готова', () => {
    expect(getCurrentRouteName()).toBeUndefined();
  });
});
