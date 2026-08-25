import { YamapInstance } from 'react-native-yamap-plus'

export const YAMAP_API_KEY = 'c7ad032b-5368-4449-9e21-c50d73ea0026'

let initPromise: Promise<boolean> | null = null

export function resetYaMapInit() {
  initPromise = null
}

export function initYaMap(options?: { force?: boolean }): Promise<boolean> {
  if (options?.force) {
    initPromise = null
  }

  if (!initPromise) {
    initPromise = Promise.resolve()
      .then(() => YamapInstance.init(YAMAP_API_KEY))
      .then(() => true)
      .catch((error) => {
        console.log(error)
        initPromise = null
        return false
      })
  }

  return initPromise
}
