import * as Keychain from 'react-native-keychain'

import {
  clearLaravelAuthToken,
  getLaravelAuthToken,
  saveLaravelAuthToken,
} from '@/shared/lib/laravelAuthTokenStorage'

describe('Laravel auth token secure storage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(Keychain as any).__reset()
  })

  it('сохраняет, читает и удаляет Bearer token через Keychain', async () => {
    await saveLaravelAuthToken('token-1')

    await expect(getLaravelAuthToken()).resolves.toBe('token-1')
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'bearer-token',
      'token-1',
      expect.objectContaining({
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        service: 'com.jacochef.driver.laravel-token',
      }),
    )

    await clearLaravelAuthToken()

    await expect(getLaravelAuthToken()).resolves.toBe('')
  })
})
