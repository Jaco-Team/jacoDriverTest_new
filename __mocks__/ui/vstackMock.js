// __mocks__/ui/vstackMock.js
const React = require('react');

const VStack = React.forwardRef((props, ref) =>
  React.createElement('RN_VIEW', { ref, 'data-ui': 'VStack', ...props }, props?.children ?? null)
);
VStack.displayName = 'VStack(Mock)';
VStack.VStack = VStack;

module.exports = { __esModule: true, VStack, default: VStack };

