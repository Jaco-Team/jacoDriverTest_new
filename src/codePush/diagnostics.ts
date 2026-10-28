import NativeCodePush, {type NativeDiagnosticsResult} from './NativeCodePush';

export interface CodePushDiagnostics extends NativeDiagnosticsResult {
  status: 'ready' | 'error';
  source: '' | 'embedded' | 'current' | 'previous' | 'trial' | 'metro';
  launchStatus: '' | 'running' | 'confirmed' | 'debug' | 'error';
  candidateStatus: 'none' | 'ready' | 'invalid';
  lastEvent: '' | 'confirmed' | 'launch_unconfirmed' | 'fatal_after_confirmation';
  downloadStatus: 'not_checked' | 'checking' | 'downloaded' | 'already_downloaded' |
    'disabled' | 'not_selected' | 'busy' | 'error';
  storageStatus: 'ready' | 'missing' | 'busy' | 'invalid';
}

const fields = [
  'status', 'errorCode', 'applicationIdentifier', 'nativeBuild', 'nativeRuntimeId',
  'source', 'launchStatus', 'launchReason', 'launchedPackageId', 'launchedVersion',
  'currentPackageId', 'currentVersion', 'previousPackageId', 'previousVersion',
  'candidatePackageId', 'candidateVersion', 'candidateStatus', 'lastEvent',
  'lastEventPackageSha256', 'downloadStatus', 'downloadErrorCode', 'downloadPackageId',
  'downloadVersion', 'storageStatus',
] as const;

type FailureCode = 'native_unavailable' | 'native_failure' | 'native_result_invalid';

/** Native diagnostics report Metro only in a debug build. */
export function codePushBuildType(source: CodePushDiagnostics['source']): 'Debug' | 'Release' | 'Нет сведений' {
  if (source === 'metro') return 'Debug';
  if (source === '') return 'Нет сведений';
  return 'Release';
}

export function codePushDiagnosticsFailure(errorCode: FailureCode): Readonly<CodePushDiagnostics> {
  return Object.freeze({
    status: 'error', errorCode, applicationIdentifier: '', nativeBuild: '', nativeRuntimeId: '',
    source: '', launchStatus: '', launchReason: '', launchedPackageId: '', launchedVersion: '',
    currentPackageId: '', currentVersion: '', previousPackageId: '', previousVersion: '',
    candidatePackageId: '', candidateVersion: '', candidateStatus: 'none', lastEvent: '',
    lastEventPackageSha256: '', downloadStatus: 'not_checked', downloadErrorCode: '',
    downloadPackageId: '', downloadVersion: '', storageStatus: 'invalid',
  });
}

/** Read-only shape validation. Native owns the meaning of launched/current/candidate. */
export function validateCodePushDiagnostics(value: unknown): Readonly<CodePushDiagnostics> {
  const invalid = () => codePushDiagnosticsFailure('native_result_invalid');
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return invalid();
    if (Reflect.ownKeys(value).length !== fields.length) return invalid();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const record: Record<string, string> = {};
    for (const field of fields) {
      const descriptor = descriptors[field];
      // Do not execute getters, forward extra fields, or retain a mutable bridge object.
      if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') return invalid();
      record[field] = descriptor.value;
    }
    const enums: Partial<Record<keyof CodePushDiagnostics, readonly string[]>> = {
      status: ['ready', 'error'],
      source: ['', 'embedded', 'current', 'previous', 'trial', 'metro'],
      launchStatus: ['', 'running', 'confirmed', 'debug', 'error'],
      candidateStatus: ['none', 'ready', 'invalid'],
      lastEvent: ['', 'confirmed', 'launch_unconfirmed', 'fatal_after_confirmation'],
      downloadStatus: ['not_checked', 'checking', 'downloaded', 'already_downloaded', 'disabled', 'not_selected', 'busy', 'error'],
      storageStatus: ['ready', 'missing', 'busy', 'invalid'],
    };
    for (const [field, allowed] of Object.entries(enums))
      if (!allowed.includes(record[field])) return invalid();
    const code = /^(?:[a-z][a-z0-9_]{0,63})?$/;
    const hash = /^(?:[a-f0-9]{64})?$/;
    const version = /^(?:[A-Za-z0-9][A-Za-z0-9._+-]{0,63})?$/;
    if (!['errorCode', 'launchReason', 'downloadErrorCode'].every(field => code.test(record[field])) ||
        !hash.test(record.nativeRuntimeId) || !hash.test(record.lastEventPackageSha256) ||
        !/^(?:[A-Za-z0-9][A-Za-z0-9._-]{0,254})?$/.test(record.applicationIdentifier) ||
        !/^(?:[1-9][0-9]{0,18})?$/.test(record.nativeBuild)) return invalid();
    for (const field of ['launchedVersion', 'currentVersion', 'previousVersion', 'candidateVersion', 'downloadVersion'])
      if (!version.test(record[field])) return invalid();
    for (const field of ['launchedPackageId', 'currentPackageId', 'previousPackageId', 'candidatePackageId', 'downloadPackageId']) {
      const packageId = record[field];
      if (!/^(?:[a-f0-9]{64}:[a-f0-9]{64})?$/.test(packageId) ||
          (packageId !== '' && !packageId.startsWith(`${record.nativeRuntimeId}:`))) return invalid();
    }
    if ((record.source === 'metro') !== (record.launchStatus === 'debug')) return invalid();
    if (['metro', 'embedded'].includes(record.source) &&
        (record.launchedPackageId !== '' || record.launchedVersion !== '')) return invalid();
    if (['current', 'previous', 'trial'].includes(record.source) &&
        record.launchStatus !== 'error' && (!record.launchedPackageId || !record.launchedVersion)) return invalid();
    if (record.launchStatus === 'confirmed' && !['current', 'trial'].includes(record.source)) return invalid();
    return Object.freeze(record) as unknown as Readonly<CodePushDiagnostics>;
  } catch {
    return invalid();
  }
}

/** Explicit local snapshot only: no download, apply, confirmation, or polling. */
export async function getCodePushDiagnostics(): Promise<Readonly<CodePushDiagnostics>> {
  try {
    if (!NativeCodePush || typeof NativeCodePush.getDiagnostics !== 'function')
      return codePushDiagnosticsFailure('native_unavailable');
    return validateCodePushDiagnostics(await NativeCodePush.getDiagnostics());
  } catch {
    return codePushDiagnosticsFailure('native_failure');
  }
}
