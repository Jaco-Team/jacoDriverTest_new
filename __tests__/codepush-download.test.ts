import NativeCodePush from '../src/codePush/NativeCodePush';
import {checkAndDownloadCodePush} from '../src/codePush/download';

jest.mock('../src/codePush/NativeCodePush', () => ({
  __esModule: true,
  default: {checkAndDownload: jest.fn()},
}));

const download = NativeCodePush!.checkAndDownload as jest.Mock;
const runtime = 'a'.repeat(64);
const sha256 = 'b'.repeat(64);
const success = {
  status: 'downloaded',
  errorCode: '',
  packageId: `${runtime}:${sha256}`,
  version: '1.0.1',
  nativeRuntimeId: runtime,
  packageSha256: sha256,
};

beforeEach(() => download.mockReset());

it('only requests a download explicitly, with no JS-supplied URL, key or path', async () => {
  expect(download).not.toHaveBeenCalled();
  download.mockResolvedValue(success);

  expect(await checkAndDownloadCodePush()).toEqual(success);
  expect(download).toHaveBeenCalledTimes(1);
  expect(download).toHaveBeenCalledWith();
});

it('returns native network/disk failures without losing their fixed error code', async () => {
  const result = {
    status: 'error',
    errorCode: 'disk_full',
    packageId: '',
    version: '',
    nativeRuntimeId: runtime,
    packageSha256: '',
  };
  download.mockResolvedValue(result);
  expect(await checkAndDownloadCodePush()).toEqual(result);
});

it('does not expose a rejected native exception', async () => {
  download.mockRejectedValue(new Error('SECRET_URL_AND_PATH'));
  const result = await checkAndDownloadCodePush();
  expect(result.status).toBe('error');
  expect(result.errorCode).toBe('native_failure');
  expect(JSON.stringify(result)).not.toContain('SECRET');
});

it.each([
  null,
  {...success, path: '/private/secret'},
  {...success, status: 'installed'},
  {...success, errorCode: 'https://secret'},
  {...success, version: '/private/path'},
  {...success, nativeRuntimeId: '../../other-runtime'},
  {...success, packageSha256: 'not-a-hash'},
])('fails closed on an unexpected native response: %j', async result => {
  download.mockResolvedValue(result);
  expect(await checkAndDownloadCodePush()).toMatchObject({
    status: 'error',
    errorCode: 'native_result_invalid',
    packageId: '',
  });
});
