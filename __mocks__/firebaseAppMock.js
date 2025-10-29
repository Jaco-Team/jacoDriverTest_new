const appInstance = {
  name: 'mock',
  options: {},
  delete: jest.fn(),
};

module.exports = {
  __esModule: true,
  initializeApp: jest.fn(() => appInstance),
  getApp: jest.fn(() => appInstance),
  getApps: jest.fn(() => [appInstance]),
  default: { initializeApp: jest.fn(() => appInstance) },
};
