import * as Sentry from '@sentry/react-native'
import { Analytics } from '@/analytics/AppMetricaService'

type FatalReporter = (error: Error) => void

let previousReportFatalError: FatalReporter | null = null

function getErrorUtils(): { reportFatalError?: FatalReporter } | undefined {
  return (globalThis as { ErrorUtils?: { reportFatalError?: FatalReporter } }).ErrorUtils
}

export function isReanimatedError(error: unknown): boolean {
  if (typeof error === 'string') {
    return error.includes('[Reanimated]') || error.includes('ReanimatedError')
  }
  if (!error || typeof error !== 'object') {
    return false
  }
  const e = error as { name?: string; jsEngine?: string; message?: string }
  return (
    e.name === 'ReanimatedError' ||
    e.jsEngine === 'reanimated' ||
    String(e.message ?? '').includes('[Reanimated]')
  )
}

export function getCurrentRouteName(): string | undefined {
  try {
    const { navigationRef } = require('@/app/providers/NavigationProvider') as {
      navigationRef?: {
        isReady?: () => boolean
        getCurrentRoute?: () => { name?: string } | undefined
      }
    }
    if (!navigationRef?.isReady?.()) {
      return undefined
    }
    return navigationRef.getCurrentRoute?.()?.name
  } catch {
    return undefined
  }
}

export function reportReanimatedError(error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error ?? 'ReanimatedError'))
  const route = getCurrentRouteName()
  const ctx = {
    jsEngine: (error as { jsEngine?: string })?.jsEngine ?? 'reanimated',
    route: route ?? 'unknown',
  }

  try {
    Analytics.reportError?.('ReanimatedWorklet', err, ctx)
  } catch {}

  try {
    Sentry.captureException(err, {
      tags: { jsEngine: 'reanimated' },
      extra: ctx,
    })
  } catch {}

  if (__DEV__ && !process.env.JEST_WORKER_ID) {
    console.error('[ReanimatedWorklet]', err.message, route, err.stack)
  }
}

export function resetReanimatedGuard() {
  const errorUtils = getErrorUtils()
  if (errorUtils && previousReportFatalError) {
    errorUtils.reportFatalError = previousReportFatalError
  }
  previousReportFatalError = null
  ;(globalThis as { __reanimatedGuardInstalled?: boolean }).__reanimatedGuardInstalled = false
}

export function installReanimatedGuard() {
  const g = globalThis as { __reanimatedGuardInstalled?: boolean }
  if (g.__reanimatedGuardInstalled) {
    return
  }
  g.__reanimatedGuardInstalled = true

  const errorUtils = getErrorUtils()
  if (typeof errorUtils?.reportFatalError !== 'function') {
    return
  }

  previousReportFatalError = errorUtils.reportFatalError.bind(errorUtils)
  errorUtils.reportFatalError = (error: Error) => {
    if (isReanimatedError(error)) {
      reportReanimatedError(error)
      return
    }
    previousReportFatalError?.(error)
  }
}

installReanimatedGuard()
