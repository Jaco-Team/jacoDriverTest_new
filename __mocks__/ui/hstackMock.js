// __mocks__/ui/hstackMock.js
const React = require('react');

const HStack = React.forwardRef((props, ref) =>
  React.createElement('RN_VIEW', { ref, 'data-ui': 'HStack', ...props }, props?.children ?? null)
);
HStack.displayName = 'HStack(Mock)';

// 🔧 магия совместимости:
HStack.HStack = HStack; // теперь default.HStack тоже валиден

module.exports = { __esModule: true, HStack, default: HStack };
