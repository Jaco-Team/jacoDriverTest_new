import {
  createCodePushReadiness,
  createCodePushReadyRunner,
  isCodePushUiReady,
} from '@/codePush/readiness';

const attemptId = 'a'.repeat(32);
const running = {status: 'running', source: 'trial', attemptId};
const confirmed = {status: 'confirmed', source: 'trial', attemptId};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise; });
  return {promise, resolve};
}

async function settle() {
  for (let step = 0; step < 15; step += 1) await Promise.resolve();
}

function readyEvidence(route: 'Auth' | 'List_orders' = 'List_orders') {
  const evidence = createCodePushReadiness();
  const epoch = evidence.beginRestore();
  evidence.setRoute(route);
  evidence.finishRestore(epoch, route === 'Auth' ? 'auth-screen' : 'authenticated');
  evidence.commitScreen(route, epoch);
  return evidence;
}

function setup() {
  const dependencies = {
    getLaunchState: jest.fn(async () => running),
    confirmLaunch: jest.fn(async () => confirmed),
    restoreLocalState: jest.fn(async () => true),
    assetsReady: jest.fn(() => true),
  };
  const runner = createCodePushReadyRunner(dependencies);
  return {dependencies, runner};
}

describe('CodePush readiness evidence', () => {
  it('requires a completed restoration and the matching screen commit', () => {
    const evidence = createCodePushReadiness();
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(false);
    const epoch = evidence.beginRestore();
    evidence.setRoute('Auth');
    evidence.commitScreen('Auth', epoch);
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(false);
    evidence.finishRestore(epoch, 'authenticated');
    evidence.commitScreen('Auth', epoch);
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(false);
    evidence.setRoute('List_orders');
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(false);
    evidence.commitScreen('List_orders', epoch);
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(true);
  });

  it('ignores stale restoration and screen callbacks after a newer check starts', () => {
    const evidence = readyEvidence('Auth');
    const oldEpoch = evidence.getSnapshot().epoch;
    const epoch = evidence.beginRestore();
    evidence.finishRestore(oldEpoch, 'auth-screen');
    evidence.commitScreen('Auth', oldEpoch);
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(false);
    evidence.finishRestore(epoch, 'auth-screen');
    evidence.commitScreen('Auth', epoch);
    evidence.unmountScreen('Auth', oldEpoch);
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(true);
    evidence.unmountScreen('Auth', epoch);
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(false);
  });

  it('an error cannot be confirmed by rendering a login screen', () => {
    const evidence = readyEvidence('Auth');
    const epoch = evidence.beginRestore();
    evidence.finishRestore(epoch, 'error');
    evidence.commitScreen('Auth', evidence.getSnapshot().epoch);
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(false);
  });

  it('does not acknowledge overlapping boot restores whose stores can still be changed by an older callback', () => {
    const evidence = createCodePushReadiness();
    const older = evidence.beginRestore();
    const newer = evidence.beginRestore();
    evidence.setRoute('Auth');
    evidence.finishRestore(newer, 'auth-screen');
    evidence.commitScreen('Auth', newer);
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(false);
    evidence.finishRestore(older, 'authenticated');
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(false);
    const fresh = evidence.beginRestore();
    evidence.finishRestore(fresh, 'auth-screen');
    evidence.commitScreen('Auth', fresh);
    expect(isCodePushUiReady(evidence.getSnapshot())).toBe(true);
  });
});

describe('CodePush launch acknowledgment', () => {
  it.each(['Auth', 'List_orders'] as const)('confirms once after real local restoration on %s', async route => {
    const {runner, dependencies} = setup();
    const local = deferred<boolean>();
    dependencies.restoreLocalState.mockReturnValueOnce(local.promise);
    const snapshot = readyEvidence(route).getSnapshot();
    runner.update(snapshot, true);
    await settle();
    expect(dependencies.confirmLaunch).not.toHaveBeenCalled();
    local.resolve(true);
    await settle();
    expect(dependencies.confirmLaunch).toHaveBeenCalledWith(attemptId);
    expect(dependencies.confirmLaunch).toHaveBeenCalledTimes(1);
    runner.update(snapshot, true);
    runner.update(snapshot, false);
    runner.update(snapshot, true);
    await settle();
    expect(dependencies.confirmLaunch).toHaveBeenCalledTimes(1);
  });

  it('does nothing until both foreground and screen readiness exist', async () => {
    const {runner, dependencies} = setup();
    runner.update(createCodePushReadiness().getSnapshot(), true);
    runner.update(readyEvidence().getSnapshot(), false);
    await settle();
    expect(dependencies.getLaunchState).not.toHaveBeenCalled();
  });

  it.each(['background', 'new-restore', 'route-change', 'unmount'] as const)('drops an awaited restoration after %s', async change => {
    const {runner, dependencies} = setup();
    const evidence = readyEvidence();
    const local = deferred<boolean>();
    dependencies.restoreLocalState.mockReturnValueOnce(local.promise);
    runner.update(evidence.getSnapshot(), true);
    await settle();
    if (change === 'background') runner.update(evidence.getSnapshot(), false);
    else if (change === 'unmount') runner.dispose();
    else {
      if (change === 'new-restore') evidence.beginRestore();
      else evidence.setRoute('Map');
      runner.update(evidence.getSnapshot(), true);
    }
    local.resolve(true);
    await settle();
    expect(dependencies.confirmLaunch).not.toHaveBeenCalled();
  });

  it('waits for a fresh foreground check after returning from background', async () => {
    const {runner, dependencies} = setup();
    const evidence = readyEvidence();
    const local = deferred<boolean>();
    dependencies.restoreLocalState.mockReturnValueOnce(local.promise);
    runner.update(evidence.getSnapshot(), true);
    await settle();
    runner.update(evidence.getSnapshot(), false);
    runner.update(evidence.getSnapshot(), true);
    local.resolve(true);
    await settle();
    expect(dependencies.restoreLocalState).toHaveBeenCalledTimes(2);
    expect(dependencies.confirmLaunch).toHaveBeenCalledTimes(1);
  });

  it.each(['failed-read', 'assets-unavailable', 'native-unavailable', 'invalid-attempt'] as const)('fails closed for %s', async failure => {
    const {runner, dependencies} = setup();
    if (failure === 'failed-read') dependencies.restoreLocalState.mockResolvedValueOnce(false);
    if (failure === 'assets-unavailable') dependencies.assetsReady.mockReturnValue(false);
    if (failure === 'native-unavailable') dependencies.getLaunchState.mockResolvedValueOnce({...running, status: 'error'});
    if (failure === 'invalid-attempt') dependencies.getLaunchState.mockResolvedValueOnce({...running, attemptId: 'A'.repeat(32)});
    runner.update(readyEvidence().getSnapshot(), true);
    await settle();
    expect(dependencies.confirmLaunch).not.toHaveBeenCalled();
  });

  it('allows a fresh readiness check to retry a failed or mismatched confirmation', async () => {
    for (const result of [{...confirmed, status: 'error'}, {...confirmed, attemptId: 'b'.repeat(32)}]) {
      const {runner, dependencies} = setup();
      dependencies.confirmLaunch.mockResolvedValueOnce(result);
      const snapshot = readyEvidence().getSnapshot();
      runner.update(snapshot, true);
      await settle();
      expect(dependencies.confirmLaunch).toHaveBeenCalledTimes(1);
      runner.update(snapshot, true);
      await settle();
      expect(dependencies.confirmLaunch).toHaveBeenCalledTimes(2);
      runner.update(snapshot, true);
      await settle();
      expect(dependencies.confirmLaunch).toHaveBeenCalledTimes(2);
    }
  });

  it.each(['embedded', 'current', 'previous'])('finishes %s readiness without confirming a trial', async source => {
    const {runner, dependencies} = setup();
    dependencies.getLaunchState.mockResolvedValueOnce({...running, source, attemptId: ''});
    const snapshot = readyEvidence().getSnapshot();
    runner.update(snapshot, true);
    await settle();
    runner.update(snapshot, true);
    await settle();
    expect(dependencies.confirmLaunch).not.toHaveBeenCalled();
    expect(dependencies.getLaunchState).toHaveBeenCalledTimes(1);
    expect(dependencies.restoreLocalState).toHaveBeenCalledTimes(1);
  });

  it('supports an already acknowledged native attempt without acknowledging it again', async () => {
    const {runner, dependencies} = setup();
    dependencies.getLaunchState.mockResolvedValueOnce(confirmed);
    runner.update(readyEvidence().getSnapshot(), true);
    await settle();
    expect(dependencies.confirmLaunch).not.toHaveBeenCalled();
  });
});
