import NativeCodePush from '@/codePush/NativeCodePush';
import {codePushBuildType, getCodePushDiagnostics, validateCodePushDiagnostics} from '@/codePush/diagnostics';
import {createCodePushDiagnosticsStore} from '@/codePush/diagnosticsStore';

jest.mock('@/codePush/NativeCodePush', () => ({
  __esModule: true,
  default: {
    getDiagnostics: jest.fn(), checkAndDownload: jest.fn(),
    getLaunchState: jest.fn(), confirmLaunch: jest.fn(),
  },
}));

const native = NativeCodePush!;
const read = native.getDiagnostics as jest.Mock;
const runtime = 'a'.repeat(64);
const packageId = (letter: string) => `${runtime}:${letter.repeat(64)}`;

function fixture() {
  return {
    status: 'ready', errorCode: '', applicationIdentifier: 'com.jacodrivertest.localtest',
    nativeBuild: '3', nativeRuntimeId: runtime, source: 'trial', launchStatus: 'running',
    launchReason: 'trial_pending', launchedPackageId: packageId('b'), launchedVersion: '1.0.2',
    currentPackageId: packageId('c'), currentVersion: '1.0.1', previousPackageId: '', previousVersion: '',
    candidatePackageId: packageId('b'), candidateVersion: '1.0.2', candidateStatus: 'ready',
    lastEvent: '', lastEventPackageSha256: '', downloadStatus: 'not_checked',
    downloadErrorCode: '', downloadPackageId: '', downloadVersion: '',
    storageStatus: 'ready',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
}

beforeEach(() => jest.clearAllMocks());

describe('read-only native diagnostics', () => {
  it.each([
    ['metro', 'Debug'], ['embedded', 'Release'], ['current', 'Release'],
    ['previous', 'Release'], ['trial', 'Release'], ['', 'Нет сведений'],
  ] as const)('shows the build type for native source %s', (source, expected) => {
    expect(codePushBuildType(source)).toBe(expected);
  });

  it('does not read, download, apply or confirm on import; an explicit read takes no arguments', async () => {
    expect(read).not.toHaveBeenCalled();
    read.mockResolvedValue(fixture());
    expect(await getCodePushDiagnostics()).toEqual(fixture());
    expect(read).toHaveBeenCalledWith();
    expect(native.checkAndDownload).not.toHaveBeenCalled();
    expect(native.getLaunchState).not.toHaveBeenCalled();
    expect(native.confirmLaunch).not.toHaveBeenCalled();
  });

  it('keeps launched, confirmed and downloaded identities separate', async () => {
    const value = {...fixture(), candidatePackageId: packageId('d'), candidateVersion: '1.0.3',
      downloadStatus: 'checking', downloadPackageId: '', downloadVersion: '',
      lastEvent: 'confirmed', lastEventPackageSha256: 'c'.repeat(64)};
    read.mockResolvedValue(value);
    const result = await getCodePushDiagnostics();
    expect(result).toEqual(value);
    expect(result.launchedVersion).toBe('1.0.2');
    expect(result.currentVersion).toBe('1.0.1');
    expect(result.candidateVersion).toBe('1.0.3');
    expect(result.launchStatus).toBe('running');
  });

  it.each(['missing', 'busy', 'invalid'])('preserves native launch identity when storage is %s', async storageStatus => {
    const value = {...fixture(), storageStatus, candidateStatus: 'invalid',
      candidatePackageId: '', candidateVersion: '', errorCode: 'storage_error'};
    read.mockResolvedValue(value);
    expect(await getCodePushDiagnostics()).toEqual(value);
  });

  it('does not invent missing version strings in partially readable native state', async () => {
    const value = {...fixture(), currentVersion: '', candidateVersion: '', candidateStatus: 'invalid'};
    read.mockResolvedValue(value);
    expect(await getCodePushDiagnostics()).toEqual(value);
  });

  it.each(['embedded', 'metro'])('supports %s without fabricating an OTA launch', source => {
    const value = {...fixture(), source, launchedPackageId: '', launchedVersion: '',
      launchStatus: source === 'metro' ? 'debug' : 'running'};
    expect(validateCodePushDiagnostics(value)).toEqual(value);
  });

  it('accepts a same-process confirmed trial without changing its native source', () => {
    const value = {...fixture(), launchStatus: 'confirmed',
      currentPackageId: packageId('b'), currentVersion: '1.0.2'};
    expect(validateCodePushDiagnostics(value)).toEqual(value);
  });

  it('copies and freezes the snapshot instead of retaining the mutable native object', () => {
    const value = fixture();
    const result = validateCodePushDiagnostics(Object.freeze({...value}));
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    value.currentVersion = 'changed';
    expect(result.currentVersion).toBe('1.0.1');
  });

  it.each([
    null, [], 'secret', {...fixture(), path: '/private/secret'},
    {...fixture(), nativeBuild: 3}, {...fixture(), currentVersion: undefined},
    {...fixture(), status: 'installed'}, {...fixture(), source: 'latest'},
    {...fixture(), launchStatus: 'ready'}, {...fixture(), candidateStatus: 'installed'},
    {...fixture(), lastEvent: 'crash'}, {...fixture(), downloadStatus: 'applied'},
    {...fixture(), storageStatus: 'deleted'},
    {...fixture(), errorCode: 'https://secret.example/token'},
    {...fixture(), launchReason: '/private/path'}, {...fixture(), downloadErrorCode: 'SECRET_TOKEN'},
    {...fixture(), nativeRuntimeId: 'A'.repeat(64)}, {...fixture(), lastEventPackageSha256: 'b'.repeat(63)},
    {...fixture(), applicationIdentifier: 'com.example\nsecret'},
    {...fixture(), nativeBuild: '01'}, {...fixture(), nativeBuild: '0'},
    {...fixture(), nativeBuild: '9'.repeat(20)}, {...fixture(), launchedVersion: 'x'.repeat(65)},
    {...fixture(), candidateVersion: '../../private'},
    {...fixture(), launchedPackageId: ''}, {...fixture(), launchedVersion: ''},
    {...fixture(), source: 'embedded'}, {...fixture(), source: 'metro'},
    {...fixture(), source: 'previous', launchStatus: 'confirmed'},
  ])('fails closed for an invalid native value %#', value => {
    const result = validateCodePushDiagnostics(value);
    expect(result).toMatchObject({status: 'error', errorCode: 'native_result_invalid',
      applicationIdentifier: '', launchedPackageId: '', currentPackageId: '', candidatePackageId: ''});
    expect(Object.keys(result)).toHaveLength(24);
    expect(JSON.stringify(result)).not.toMatch(/secret|private|TOKEN/);
  });

  it.each(['launchedPackageId', 'currentPackageId', 'previousPackageId', 'candidatePackageId', 'downloadPackageId'])(
    'rejects a foreign runtime in %s', field => {
      expect(validateCodePushDiagnostics({...fixture(), [field]: `${'e'.repeat(64)}:${'b'.repeat(64)}`}))
        .toMatchObject({status: 'error', errorCode: 'native_result_invalid'});
    },
  );

  it('rejects getters and extra hidden/symbol fields without executing them', () => {
    const getter = jest.fn(() => 'SECRET');
    const accessor = {...fixture()};
    Object.defineProperty(accessor, 'errorCode', {get: getter});
    const hidden = Object.defineProperty({...fixture()}, 'path', {value: '/private/path'});
    const symbolic = {...fixture(), [Symbol('secret')]: 'SECRET'};
    const inherited = Object.create(fixture());
    for (const value of [accessor, hidden, symbolic, inherited])
      expect(validateCodePushDiagnostics(value).errorCode).toBe('native_result_invalid');
    expect(getter).not.toHaveBeenCalled();
  });

  it('hides rejected native exceptions and tolerates an absent module/method', async () => {
    read.mockRejectedValueOnce(new Error('SECRET_URL_AND_PRIVATE_PATH'));
    expect(await getCodePushDiagnostics()).toMatchObject({status: 'error', errorCode: 'native_failure'});
    const module = require('@/codePush/NativeCodePush');
    const original = module.default;
    try {
      module.default = null;
      expect(await getCodePushDiagnostics()).toMatchObject({status: 'error', errorCode: 'native_unavailable'});
      module.default = {};
      expect(await getCodePushDiagnostics()).toMatchObject({status: 'error', errorCode: 'native_unavailable'});
    } finally { module.default = original; }
  });
});

describe('diagnostics presentation cache', () => {
  it('reads only on demand and coalesces concurrent refreshes before subscriber callbacks', async () => {
    const pending = deferred<unknown>();
    const get = jest.fn(() => pending.promise);
    const store = createCodePushDiagnosticsStore(get);
    expect(get).not.toHaveBeenCalled();
    const snapshots: string[] = [];
    store.subscribe(() => {
      snapshots.push(store.getSnapshot().status);
      if (store.getSnapshot().status === 'loading') void store.refresh();
    });
    const first = store.refresh();
    expect(store.refresh()).toBe(first);
    await Promise.resolve();
    expect(get).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({status: 'loading', result: null});
    pending.resolve(fixture());
    await first;
    expect(snapshots).toEqual(['loading', 'ready']);
    expect(store.getSnapshot()).toEqual({status: 'ready', result: fixture()});
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
    expect(Object.isFrozen(store.getSnapshot().result)).toBe(true);
  });

  it('drops a late result after clearing without changing native state', async () => {
    const pending = deferred<unknown>();
    const store = createCodePushDiagnosticsStore(() => pending.promise);
    const request = store.refresh();
    store.clear();
    pending.resolve(fixture());
    await request;
    expect(store.getSnapshot()).toEqual({status: 'idle', result: null});
    expect(native.checkAndDownload).not.toHaveBeenCalled();
    expect(native.confirmLaunch).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)('an old %s cannot overwrite a newer snapshot or clear its pending request', async finish => {
    const old = deferred<unknown>();
    const newer = deferred<unknown>();
    const get = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise);
    const store = createCodePushDiagnosticsStore(get);
    const first = store.refresh();
    await Promise.resolve();
    store.clear();
    const second = store.refresh();
    await Promise.resolve();
    if (finish === 'resolve') old.resolve({...fixture(), currentVersion: 'old'});
    else old.reject(new Error('SECRET'));
    await first;
    expect(store.refresh()).toBe(second);
    expect(store.getSnapshot()).toEqual({status: 'loading', result: null});
    newer.resolve({...fixture(), currentVersion: 'new'});
    await second;
    expect(store.getSnapshot().result?.currentVersion).toBe('new');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('clears stale success on refresh failure and allows a later explicit retry', async () => {
    const get = jest.fn().mockResolvedValueOnce(fixture())
      .mockRejectedValueOnce(new Error('SECRET')).mockResolvedValueOnce(fixture());
    const store = createCodePushDiagnosticsStore(get);
    const unsubscribe = store.subscribe(jest.fn());
    await store.refresh();
    const failed = store.refresh();
    expect(store.getSnapshot()).toEqual({status: 'loading', result: null});
    await failed;
    expect(store.getSnapshot()).toMatchObject({status: 'error', result: {errorCode: 'native_failure', currentPackageId: ''}});
    unsubscribe();
    await store.refresh();
    expect(store.getSnapshot().status).toBe('ready');
    expect(get).toHaveBeenCalledTimes(3);
  });
});
