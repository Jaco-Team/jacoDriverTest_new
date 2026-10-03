import { Platform } from 'react-native'
import { YamapInstance } from 'react-native-yamap-plus'

export const YAMAP_API_KEY = 'b18f9642-b69f-47d9-b60d-e443b6dd77cd'

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
      .then(async () => {
        if (Platform.OS === 'android') {
          try {
            // Android applies this only before the first MapKit initialization.
            await YamapInstance.setLocale('ru_RU')
          } catch {
            // A Fast Refresh can reuse an already initialized native MapKit.
          }
        }

        await YamapInstance.init(YAMAP_API_KEY)
      })
      .then(() => true)
      .catch((error) => {
        console.log(error)
        initPromise = null
        return false
      })
  }

  return initPromise
}
