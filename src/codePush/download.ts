import NativeCodePush, {type NativeDownloadResult} from './NativeCodePush';

export type DownloadStatus =
  | 'downloaded'
  | 'already_downloaded'
  | 'disabled'
  | 'not_selected'
  | 'busy'
  | 'error';

export interface DownloadResult extends NativeDownloadResult {
  status: DownloadStatus;
}

const statuses: readonly string[] = [
  'downloaded',
  'already_downloaded',
  'disabled',
  'not_selected',
  'busy',
  'error',
];
const fields = [
  'status',
  'errorCode',
  'packageId',
  'version',
  'nativeRuntimeId',
  'packageSha256',
] as const;

function failure(errorCode: string): DownloadResult {
  return {
    status: 'error',
    errorCode,
    packageId: '',
    version: '',
    nativeRuntimeId: '',
    packageSha256: '',
  };
}

/** Explicit request only. Importing this module never checks S3 or switches JS. */
export async function checkAndDownloadCodePush(): Promise<DownloadResult> {
  if (!NativeCodePush) return failure('native_unavailable');
  try {
    const result: unknown = await NativeCodePush.checkAndDownload();
    if (result === null || typeof result !== 'object' || Array.isArray(result))
      return failure('native_result_invalid');
    const record = result as Record<string, unknown>;
    if (
      Object.keys(record).length !== fields.length ||
      !fields.every(field => typeof record[field] === 'string') ||
      !statuses.includes(record.status as string) ||
      !/^(?:[a-z][a-z0-9_]{0,63})?$/.test(record.errorCode as string) ||
      !/^(?:[a-f0-9]{64})?$/.test(record.nativeRuntimeId as string) ||
      !/^(?:[a-f0-9]{64})?$/.test(record.packageSha256 as string) ||
      !/^(?:[a-f0-9]{64}:[a-f0-9]{64})?$/.test(record.packageId as string) ||
      !/^(?:[A-Za-z0-9][A-Za-z0-9._+-]{0,63})?$/.test(record.version as string)
    )
      return failure('native_result_invalid');
    // Never forward unexpected native fields or raw exception details to callers.
    return {
      status: record.status as DownloadStatus,
      errorCode: record.errorCode as string,
      packageId: record.packageId as string,
      version: record.version as string,
      nativeRuntimeId: record.nativeRuntimeId as string,
      packageSha256: record.packageSha256 as string,
    };
  } catch {
    return failure('native_failure');
  }
}
