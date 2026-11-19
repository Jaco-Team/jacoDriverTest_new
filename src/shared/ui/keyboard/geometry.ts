export type Rect = { x: number; y: number; width: number; height: number };

type ScrollGeometry = {
  viewport: Rect;
  canvasHeight: number;
  group: Rect;
  active?: Rect;
  keyboard: Rect | null;
  gap: number;
};

// All field coordinates belong to the stable canvas. Keyboard coordinates
// belong to the window; an Android adjustResize viewport already excludes IME.
export function getKeyboardScrollGeometry({
  viewport,
  canvasHeight,
  group,
  active,
  keyboard,
  gap,
}: ScrollGeometry) {
  if (!keyboard) return { target: 0, spacer: 0 };
  let visibleBottom = viewport.height;
  const keyboardTop = keyboard.y - viewport.y;
  const keyboardBottom = keyboardTop + keyboard.height;
  const overlapsHorizontally =
    keyboard.x < viewport.x + group.x + group.width &&
    keyboard.x + keyboard.width > viewport.x + group.x;
  const docked =
    keyboard.x <= viewport.x + 1 &&
    keyboard.x + keyboard.width >= viewport.x + viewport.width - 1 &&
    keyboardBottom >= viewport.height - 1;
  const coversGroup =
    keyboardTop < group.y + group.height + gap && keyboardBottom > group.y;
  if (overlapsHorizontally && (docked || coversGroup)) {
    visibleBottom = Math.max(0, Math.min(visibleBottom, keyboardTop));
  }

  // If the pair cannot fit, prioritize the focused input. The remaining
  // content remains reachable by a manual scroll.
  const field = group.height + gap <= visibleBottom ? group : (active ?? group);
  const target = Math.max(0, field.y + field.height + gap - visibleBottom);
  const manualTarget = Math.max(
    target,
    group.y + group.height + gap - visibleBottom,
  );
  return {
    target,
    spacer: Math.max(0, manualTarget + viewport.height - canvasHeight),
  };
}
