import NativeCodePush from '../src/codePush/NativeCodePush';
import {
  confirmCodePushLaunch,
  getCodePushLaunchState,
} from '../src/codePush/lifecycle';

jest.mock('../src/codePush/NativeCodePush', () => ({
  __esModule: true,
  default: {getLaunchState: jest.fn(), confirmLaunch: jest.fn()},
}));

const native = NativeCodePush!;
const getState = native.getLaunchState as jest.Mock;
const confirm = native.confirmLaunch as jest.Mock;
const runtime = 'a'.repeat(64);
const attempt = 'c'.repeat(32);
const trial = {
  status: 'running',
  errorCode: '',
  packageId: `${runtime}:${'b'.repeat(64)}`,
  version: '1.0.1',
  nativeRuntimeId: runtime,
  attemptId: attempt,
  source: 'trial',
};

beforeEach(() => {
  getState.mockReset();
  confirm.mockReset();
});

it('only reads native identity explicitly, without acknowledging a launch', async () => {
  expect(getState).not.toHaveBeenCalled();
  getState.mockResolvedValue(trial);
  expect(await getCodePushLaunchState()).toEqual(trial);
  expect(getState).toHaveBeenCalledWith();
  expect(confirm).not.toHaveBeenCalled();
});

it('acknowledges only the exact supplied native attempt', async () => {
  confirm.mockResolvedValue({...trial, status: 'confirmed'});
  expect(await confirmCodePushLaunch(attempt)).toEqual({
    ...trial,
    status: 'confirmed',
  });
  expect(confirm).toHaveBeenCalledWith(attempt);
});

it('rejects a confirmation reply for a different attempt', async () => {
  confirm.mockResolvedValue({
    ...trial,
    status: 'confirmed',
    attemptId: 'd'.repeat(32),
  });
  expect(await confirmCodePushLaunch(attempt)).toMatchObject({
    status: 'error',
    errorCode: 'native_result_invalid',
  });
});

it.each(['', '../attempt', 'C'.repeat(32), 'a'.repeat(31)])(
  'rejects invalid attempt %j before crossing the bridge',
  async value => {
    expect(await confirmCodePushLaunch(value)).toMatchObject({
      status: 'error',
      errorCode: 'attempt_invalid',
    });
    expect(confirm).not.toHaveBeenCalled();
  },
);

it.each([
  null,
  {...trial, path: '/private/secret'},
  {...trial, status: 'installed'},
  {...trial, source: 'latest'},
  {...trial, errorCode: 'SECRET_URL'},
  {...trial, packageId: `${'d'.repeat(64)}:${'b'.repeat(64)}`},
  {...trial, attemptId: ''},
  {...trial, source: 'embedded'},
  {...trial, source: 'current'},
  {...trial, nativeRuntimeId: ''},
])('rejects malformed launch identity %j', async value => {
  getState.mockResolvedValue(value);
  expect(await getCodePushLaunchState()).toMatchObject({
    status: 'error',
    errorCode: 'native_result_invalid',
  });
});

it('accepts embedded identity without pretending it is an OTA attempt', async () => {
  const embedded = {
    ...trial,
    packageId: '',
    version: '',
    source: 'embedded',
    attemptId: '',
  };
  getState.mockResolvedValue(embedded);
  expect(await getCodePushLaunchState()).toEqual(embedded);
});

it.each(['getLaunchState', 'confirmLaunch'] as const)(
  'hides rejected native exception details from %s',
  async method => {
    (native[method] as jest.Mock).mockRejectedValue(
      new Error('SECRET_URL_AND_PERSONAL_DATA'),
    );
    const result =
      method === 'getLaunchState'
        ? await getCodePushLaunchState()
        : await confirmCodePushLaunch(attempt);
    expect(result).toMatchObject({
      status: 'error',
      errorCode: 'native_failure',
    });
    expect(JSON.stringify(result)).not.toContain('SECRET');
  },
);
