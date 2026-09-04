const credentialsByService = new Map()

const getService = options => options?.service || 'default'

module.exports = {
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly',
  },
  setGenericPassword: jest.fn(async (username, password, options) => {
    credentialsByService.set(getService(options), {
      password,
      service: getService(options),
      storage: 'MOCK',
      username,
    })
    return {service: getService(options), storage: 'MOCK'}
  }),
  getGenericPassword: jest.fn(async options =>
    credentialsByService.get(getService(options)) || false,
  ),
  resetGenericPassword: jest.fn(async options =>
    credentialsByService.delete(getService(options)),
  ),
  __reset: () => credentialsByService.clear(),
}
