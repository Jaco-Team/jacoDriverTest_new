import NativeCodePush, {type NativeLaunchResult} from './NativeCodePush';

export interface LaunchResult extends NativeLaunchResult {
  status: 'running' | 'confirmed' | 'error';
  source: '' | 'embedded' | 'current' | 'previous' | 'trial';
}

const fields = [
  'status',
  'errorCode',
  'packageId',
  'version',
  'nativeRuntimeId',
  'attemptId',
  'source',
] as const;

function failure(errorCode: string): LaunchResult {
  return {
    status: 'error',
    errorCode,
    packageId: '',
    version: '',
    nativeRuntimeId: '',
    attemptId: '',
    source: '',
  };
}

function validate(value: unknown): LaunchResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return failure('native_result_invalid');
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== fields.length ||
    !fields.every(field => typeof record[field] === 'string') ||
    !['running', 'confirmed', 'error'].includes(record.status as string) ||
    !['', 'embedded', 'current', 'previous', 'trial'].includes(
      record.source as string,
    ) ||
    !/^(?:[a-z][a-z0-9_]{0,63})?$/.test(record.errorCode as string) ||
    !/^(?:[a-f0-9]{64})?$/.test(record.nativeRuntimeId as string) ||
    !/^(?:[a-f0-9]{64}:[a-f0-9]{64})?$/.test(record.packageId as string) ||
    !/^(?:[a-f0-9]{32})?$/.test(record.attemptId as string) ||
    !/^(?:[A-Za-z0-9][A-Za-z0-9._+\-]{0,63})?$/.test(record.version as string)
  )
    return failure('native_result_invalid');
  if (record.status !== 'error') {
    const embedded = record.source === 'embedded';
    if (
      !(record.nativeRuntimeId as string).length ||
      record.errorCode !== '' ||
      record.source === '' ||
      (embedded &&
        (record.packageId !== '' ||
          record.version !== '' ||
          record.attemptId !== '')) ||
      (!embedded &&
        (!(record.packageId as string).startsWith(
          `${record.nativeRuntimeId}:`,
        ) ||
          record.version === '')) ||
      (record.source === 'trial'
        ? record.attemptId === ''
        : record.attemptId !== '') ||
      (record.status === 'confirmed' &&
        record.source !== 'trial' &&
        record.source !== 'current')
    )
      return failure('native_result_invalid');
  }
  return {
    status: record.status as LaunchResult['status'],
    errorCode: record.errorCode as string,
    packageId: record.packageId as string,
    version: record.version as string,
    nativeRuntimeId: record.nativeRuntimeId as string,
    attemptId: record.attemptId as string,
    source: record.source as LaunchResult['source'],
  };
}

/** Reading native launch identity never downloads, activates or confirms a bundle. */
export async function getCodePushLaunchState(): Promise<LaunchResult> {
  if (!NativeCodePush) return failure('native_unavailable');
  try {
    return validate(await NativeCodePush.getLaunchState());
  } catch {
    return failure('native_failure');
  }
}

/** Only a caller with real readiness evidence may acknowledge the native attempt. */
export async function confirmCodePushLaunch(
  attemptId: string,
): Promise<LaunchResult> {
  if (!/^[a-f0-9]{32}$/.test(attemptId)) return failure('attempt_invalid');
  if (!NativeCodePush) return failure('native_unavailable');
  try {
    const result = validate(await NativeCodePush.confirmLaunch(attemptId));
    return result.status === 'confirmed' && result.attemptId !== attemptId
      ? failure('native_result_invalid')
      : result;
  } catch {
    return failure('native_failure');
  }
}
