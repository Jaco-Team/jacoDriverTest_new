import * as Keychain from 'react-native-keychain'

const SSO_ATTEMPT_SERVICE = 'com.jacochef.driver.sso-login-attempt'
const SSO_ATTEMPT_USERNAME = 'code-verifier'

// Вход идёт в системном окне браузера, и курьер может по пути сбрасывать пароль.
// Дольше получаса начатая попытка не живёт.
export const SSO_LOGIN_ATTEMPT_TTL_MS = 30 * 60 * 1000

interface StoredSsoLoginAttempt {
  codeVerifier: string
  createdAt: number
}

/**
 * code_verifier начатого входа через SSO. Хранится в Keychain/Keystore, а не в
 * памяти: пока открыт браузер, Android может выгрузить приложение, и ссылка с
 * кодом входа придёт уже в новый процесс.
 */
export async function saveSsoLoginAttempt(codeVerifier: string): Promise<void> {
  const attempt: StoredSsoLoginAttempt = { codeVerifier, createdAt: Date.now() }

  await Keychain.setGenericPassword(SSO_ATTEMPT_USERNAME, JSON.stringify(attempt), {
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    service: SSO_ATTEMPT_SERVICE,
  })
}

/** Возвращает code_verifier начатого входа или пустую строку, если его нет или он устарел. */
export async function readSsoLoginAttempt(): Promise<string> {
  const credentials = await Keychain.getGenericPassword({ service: SSO_ATTEMPT_SERVICE })

  if (!credentials) return ''

  try {
    const attempt = JSON.parse(credentials.password) as Partial<StoredSsoLoginAttempt>
    const codeVerifier = typeof attempt.codeVerifier === 'string' ? attempt.codeVerifier : ''
    const age = Date.now() - Number(attempt.createdAt)

    if (codeVerifier && Number.isFinite(age) && age >= 0 && age <= SSO_LOGIN_ATTEMPT_TTL_MS) {
      return codeVerifier
    }
  } catch {
    // Повреждённую запись удаляем ниже.
  }

  await clearSsoLoginAttempt()
  return ''
}

export async function clearSsoLoginAttempt(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SSO_ATTEMPT_SERVICE })
}
