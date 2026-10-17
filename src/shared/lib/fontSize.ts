export const MIN_GLOBAL_FONT_SIZE = 10
export const MAX_GLOBAL_FONT_SIZE = 26
export const DEFAULT_GLOBAL_FONT_SIZE = 16

export function normalizeGlobalFontSize(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)

  if (!Number.isFinite(parsed)) {
    return DEFAULT_GLOBAL_FONT_SIZE
  }

  return Math.min(MAX_GLOBAL_FONT_SIZE, Math.max(MIN_GLOBAL_FONT_SIZE, parsed))
}

export function scaleGlobalFontSize(
  baseSize: number,
  selectedSize: unknown,
  minSize = MIN_GLOBAL_FONT_SIZE,
  maxSize = MAX_GLOBAL_FONT_SIZE,
): number {
  const normalizedSelectedSize = normalizeGlobalFontSize(selectedSize)
  const normalizedMinSize = Math.max(MIN_GLOBAL_FONT_SIZE, minSize)
  const normalizedMaxSize = Math.min(
    MAX_GLOBAL_FONT_SIZE,
    Math.max(normalizedMinSize, maxSize),
  )
  const scaledSize =
    baseSize + normalizedSelectedSize - DEFAULT_GLOBAL_FONT_SIZE

  return Math.min(
    normalizedMaxSize,
    Math.max(normalizedMinSize, scaledSize),
  )
}
