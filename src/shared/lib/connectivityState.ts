let offline = false

export function setAppOffline(value: boolean): void {
  offline = value
}

export function isAppOffline(): boolean {
  return offline
}
