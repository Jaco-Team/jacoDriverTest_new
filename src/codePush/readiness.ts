export type CodePushReadyScreen = 'Auth' | 'List_orders';
export type CodePushRestoreOutcome = 'authenticated' | 'auth-screen' | 'error';

export interface CodePushReadinessSnapshot {
  epoch: number;
  outcome: CodePushRestoreOutcome | 'restoring';
  route: string;
  committedScreen: CodePushReadyScreen | null;
}

/** Evidence from this JS runtime only; no value here authorizes applying a package. */
export function createCodePushReadiness() {
  let snapshot: CodePushReadinessSnapshot = Object.freeze({
    epoch: 0,
    outcome: 'restoring',
    route: 'Greeting',
    committedScreen: null,
  });
  const listeners = new Set<() => void>();
  const restoring = new Set<number>();
  let overlappingRestore = false;
  const update = (changes: Partial<CodePushReadinessSnapshot>) => {
    snapshot = Object.freeze({...snapshot, ...changes});
    listeners.forEach(listener => listener());
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot,
    beginRestore() {
      const epoch = snapshot.epoch + 1;
      if (restoring.size > 0) overlappingRestore = true;
      restoring.add(epoch);
      update({epoch, outcome: 'restoring', committedScreen: null});
      return epoch;
    },
    finishRestore(epoch: number, outcome: CodePushRestoreOutcome) {
      if (!restoring.delete(epoch)) return;
      if (epoch === snapshot.epoch)
        update({outcome: overlappingRestore ? 'error' : outcome, committedScreen: null});
      if (restoring.size === 0) overlappingRestore = false;
    },
    setRoute(route: string) {
      if (route !== snapshot.route) update({route, committedScreen: null});
    },
    commitScreen(screen: CodePushReadyScreen, epoch: number) {
      if (epoch !== snapshot.epoch || snapshot.outcome === 'restoring') return;
      if (snapshot.committedScreen !== screen) update({committedScreen: screen});
    },
    unmountScreen(screen: CodePushReadyScreen, epoch: number) {
      if (epoch === snapshot.epoch && snapshot.committedScreen === screen)
        update({committedScreen: null});
    },
  };
}

export const codePushReadiness = createCodePushReadiness();

export function isCodePushUiReady(snapshot: CodePushReadinessSnapshot): boolean {
  const screen = snapshot.outcome === 'authenticated' ? 'List_orders'
    : snapshot.outcome === 'auth-screen' ? 'Auth' : null;
  return snapshot.epoch > 0 && screen !== null &&
    snapshot.route === screen && snapshot.committedScreen === screen;
}

interface LaunchState {
  status: string;
  source: string;
  attemptId: string;
}
interface ReadinessDependencies {
  getLaunchState: () => Promise<LaunchState>;
  confirmLaunch: (attemptId: string) => Promise<LaunchState>;
  restoreLocalState: () => Promise<boolean>;
  assetsReady: () => boolean;
}

/** Once per process: confirmation follows actual restoration and a visible screen commit. */
export function createCodePushReadyRunner(dependencies: ReadinessDependencies) {
  let generation = 0;
  let current: CodePushReadinessSnapshot | null = null;
  let active = false;
  let inFlight = false;
  let finished = false;
  let disposed = false;

  const isCurrent = (ticket: number) => !disposed && active &&
    generation === ticket && current !== null && isCodePushUiReady(current);

  const run = async () => {
    if (disposed || inFlight || finished || !active || !current || !isCodePushUiReady(current)) return;
    inFlight = true;
    const ticket = generation;
    try {
      const launch = await dependencies.getLaunchState();
      if (!isCurrent(ticket) || !['running', 'confirmed'].includes(launch.status) ||
          !dependencies.assetsReady()) return;
      if (!(await dependencies.restoreLocalState()) || !isCurrent(ticket)) return;
      if (launch.source === 'trial') {
        if (!/^[a-f0-9]{32}$/.test(launch.attemptId)) return;
        if (launch.status !== 'confirmed') {
          const confirmed = await dependencies.confirmLaunch(launch.attemptId);
          if (!isCurrent(ticket) || confirmed.status !== 'confirmed' ||
            confirmed.attemptId !== launch.attemptId) return;
        }
      } else if (!['current', 'previous', 'embedded'].includes(launch.source)) {
        return;
      }
      if (!isCurrent(ticket)) return;
      // Native startup owns checking/downloading before JS selection. This runner
      // only acknowledges real readiness; a working screen never starts an update.
      finished = true;
    } catch {
      // Missing native support and restoration errors leave the attempt unconfirmed.
    } finally {
      inFlight = false;
      // A changed restore/route/foreground state may have invalidated an awaited call.
      if (!disposed && !finished && generation !== ticket) void run();
    }
  };

  return {
    update(snapshot: CodePushReadinessSnapshot, foreground: boolean) {
      if (disposed) return;
      if (current !== snapshot || active !== foreground) generation += 1;
      current = snapshot;
      active = foreground;
      void run();
    },
    dispose() {
      disposed = true;
      generation += 1;
    },
  };
}
