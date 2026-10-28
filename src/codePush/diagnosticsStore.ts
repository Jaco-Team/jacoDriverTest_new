import {
  codePushDiagnosticsFailure,
  getCodePushDiagnostics,
  validateCodePushDiagnostics,
  type CodePushDiagnostics,
} from './diagnostics';

export interface CodePushDiagnosticsState {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly result: Readonly<CodePushDiagnostics> | null;
}

/** Presentation cache only. Never writes native state or infers an installed version. */
export function createCodePushDiagnosticsStore(read: () => Promise<unknown> = getCodePushDiagnostics) {
  let state: CodePushDiagnosticsState = Object.freeze({status: 'idle', result: null});
  let generation = 0;
  let pending: {generation: number; promise: Promise<Readonly<CodePushDiagnostics>>} | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: CodePushDiagnosticsState) => {
    state = Object.freeze(next);
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    refresh(): Promise<Readonly<CodePushDiagnostics>> {
      if (pending) return pending.promise;
      const ticket = ++generation;
      const promise = Promise.resolve().then(read)
        .then(validateCodePushDiagnostics, () => codePushDiagnosticsFailure('native_failure'))
        .then(result => {
          if (generation === ticket) publish({status: result.status, result});
          return result;
        }).finally(() => {
          if (pending?.generation === ticket) pending = null;
        });
      // Reserve before notifying subscribers; a synchronous second refresh shares this request.
      pending = {generation: ticket, promise};
      publish({status: 'loading', result: null});
      return promise;
    },
    clear() {
      // Invalidates late local reads, not packages, secure storage, or native launch state.
      generation += 1;
      pending = null;
      publish({status: 'idle', result: null});
    },
  };
}

export const codePushDiagnosticsStore = createCodePushDiagnosticsStore();
