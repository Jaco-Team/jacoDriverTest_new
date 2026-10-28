import NativeCodePush from './NativeCodePush';

/** Preserve the existing fatal handler, giving native storage a bounded chance to record the failure. */
export function delegateFatalAfterCodePushRecord(delegate: () => void): void {
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (timer !== undefined) clearTimeout(timer);
    delegate();
  };
  try {
    if (!NativeCodePush || typeof NativeCodePush.markFatal !== 'function') {
      finish();
      return;
    }
    timer = setTimeout(finish, 2000);
    Promise.resolve(NativeCodePush.markFatal()).then(finish, finish);
  } catch {
    finish();
  }
}
