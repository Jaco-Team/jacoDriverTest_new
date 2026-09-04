import * as Keychain from 'react-native-keychain'

const LARAVEL_TOKEN_SERVICE = 'com.jacochef.driver.laravel-token'
const LARAVEL_TOKEN_USERNAME = 'bearer-token'

export async function saveLaravelAuthToken(token: string): Promise<void> {
  await Keychain.setGenericPassword(LARAVEL_TOKEN_USERNAME, token, {
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    service: LARAVEL_TOKEN_SERVICE,
  })
}

export async function getLaravelAuthToken(): Promise<string> {
  const credentials = await Keychain.getGenericPassword({
    service: LARAVEL_TOKEN_SERVICE,
  })

  return credentials ? credentials.password : ''
}

export async function clearLaravelAuthToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: LARAVEL_TOKEN_SERVICE })
}
