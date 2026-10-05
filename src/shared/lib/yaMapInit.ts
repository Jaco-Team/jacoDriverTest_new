import { Platform } from 'react-native'
import { YamapInstance } from 'react-native-yamap-plus'

// Babel reads the root .env (or CI variable) and embeds the key at build time.
export const YAMAP_API_KEY = process.env.YAMAP_API_KEY!

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
