const isAvailable = jest.fn(async () => true);
const openAuth = jest.fn(async () => ({type: 'cancel'}));

module.exports = {
  __esModule: true,
  InAppBrowser: {
    isAvailable,
    openAuth,
    closeAuth: jest.fn(),
  },
  default: {
    isAvailable,
    openAuth,
    closeAuth: jest.fn(),
  },
};
