export function toOrderInt(value: unknown): number {
  return Number.parseInt(String(value ?? 0), 10) || 0
}
