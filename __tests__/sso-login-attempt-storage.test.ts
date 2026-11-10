import * as Keychain from 'react-native-keychain'

import {
  SSO_LOGIN_ATTEMPT_TTL_MS,
  clearSsoLoginAttempt,
  readSsoLoginAttempt,
  saveSsoLoginAttempt,
} from '@/shared/lib/ssoLoginAttemptStorage'

const SERVICE = 'com.jacochef.driver.sso-login-attempt'

describe('хранилище начатого входа через SSO', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-11-10T10:00:00Z'))
    jest.clearAllMocks()
    ;(Keychain as any).__reset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('хранит code_verifier в Keychain отдельно от Bearer-токена', async () => {
    await saveSsoLoginAttempt('verifier-1')

    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'code-verifier',
      expect.stringContaining('verifier-1'),
      expect.objectContaining({
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        service: SERVICE,
      }),
    )
    await expect(readSsoLoginAttempt()).resolves.toBe('verifier-1')
    // Чтение не гасит попытку: её закрывает успешный обмен кода.
    await expect(readSsoLoginAttempt()).resolves.toBe('verifier-1')

    await clearSsoLoginAttempt()
    await expect(readSsoLoginAttempt()).resolves.toBe('')
  })

  it('новая попытка заменяет предыдущую', async () => {
    await saveSsoLoginAttempt('verifier-1')
    await saveSsoLoginAttempt('verifier-2')

    await expect(readSsoLoginAttempt()).resolves.toBe('verifier-2')
  })

  it('устаревшая попытка не используется и удаляется', async () => {
    await saveSsoLoginAttempt('verifier-1')

    jest.setSystemTime(Date.now() + SSO_LOGIN_ATTEMPT_TTL_MS)
    await expect(readSsoLoginAttempt()).resolves.toBe('verifier-1')

    jest.setSystemTime(Date.now() + 1)
    await expect(readSsoLoginAttempt()).resolves.toBe('')
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({ service: SERVICE })
  })

  it('повреждённая запись и запись из будущего считаются отсутствием попытки', async () => {
    await Keychain.setGenericPassword('code-verifier', 'not-json', { service: SERVICE })
    await expect(readSsoLoginAttempt()).resolves.toBe('')

    await Keychain.setGenericPassword(
      'code-verifier',
      JSON.stringify({ codeVerifier: 'verifier-1', createdAt: Date.now() + 60_000 }),
      { service: SERVICE },
    )
    await expect(readSsoLoginAttempt()).resolves.toBe('')

    await Keychain.setGenericPassword(
      'code-verifier',
      JSON.stringify({ codeVerifier: 42, createdAt: Date.now() }),
      { service: SERVICE },
    )
    await expect(readSsoLoginAttempt()).resolves.toBe('')
  })
})
