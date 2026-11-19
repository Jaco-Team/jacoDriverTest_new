export const KEYBOARD_SCROLL_DURATION_MS = 200;

export function getKeyboardAnimationDuration(
  platform: string,
  eventDuration: number,
): number {
  // Android core Keyboard events report duration=0 rather than an IME
  // animation duration. iOS zero remains meaningful and must be preserved.
  if (
    platform === 'android' &&
    (!Number.isFinite(eventDuration) || eventDuration <= 0)
  ) {
    return KEYBOARD_SCROLL_DURATION_MS;
  }
  return Math.max(0, eventDuration);
}
