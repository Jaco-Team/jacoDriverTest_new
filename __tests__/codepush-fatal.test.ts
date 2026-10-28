import NativeCodePush from '@/codePush/NativeCodePush';
import {delegateFatalAfterCodePushRecord} from '@/codePush/fatal';

jest.mock('@/codePush/NativeCodePush', () => ({
  __esModule: true,
  default: {markFatal: jest.fn()},
}));

const markFatal = NativeCodePush!.markFatal as jest.Mock;

beforeEach(() => { jest.useFakeTimers(); markFatal.mockReset(); });
afterEach(() => { jest.useRealTimers(); });

it('waits for the native record before delegating the fatal error', async () => {
  let finish!: (result: boolean) => void;
  markFatal.mockReturnValue(new Promise<boolean>(resolve => { finish = resolve; }));
  const delegate = jest.fn();
  delegateFatalAfterCodePushRecord(delegate);
  expect(markFatal).toHaveBeenCalledTimes(1);
  expect(delegate).not.toHaveBeenCalled();
  finish(true);
  await Promise.resolve();
  expect(delegate).toHaveBeenCalledTimes(1);
  jest.runAllTimers();
  expect(delegate).toHaveBeenCalledTimes(1);
});

it('never suppresses a fatal error if native storage fails or stalls', async () => {
  const delegate = jest.fn();
  markFatal.mockRejectedValueOnce(new Error('native failure'));
  delegateFatalAfterCodePushRecord(delegate);
  await Promise.resolve();
  expect(delegate).toHaveBeenCalledTimes(1);
  markFatal.mockReturnValueOnce(new Promise(() => {}));
  delegateFatalAfterCodePushRecord(delegate);
  jest.advanceTimersByTime(2000);
  expect(delegate).toHaveBeenCalledTimes(2);
});

it('does not forward twice if native recording completes after its timeout', async () => {
  let finish!: (result: boolean) => void;
  markFatal.mockReturnValue(new Promise<boolean>(resolve => { finish = resolve; }));
  const delegate = jest.fn();
  delegateFatalAfterCodePushRecord(delegate);
  jest.advanceTimersByTime(2000);
  finish(true);
  await Promise.resolve();
  expect(delegate).toHaveBeenCalledTimes(1);
});

it('forwards the fatal error if native recording throws synchronously', () => {
  markFatal.mockImplementation(() => { throw new Error('native unavailable'); });
  const delegate = jest.fn();
  delegateFatalAfterCodePushRecord(delegate);
  expect(delegate).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
