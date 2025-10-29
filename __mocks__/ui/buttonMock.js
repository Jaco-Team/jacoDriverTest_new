// __mocks__/ui/buttonMock.js
const React = require('react');

// Локальные "RN-хосты" — обычные функциональные компоненты.
// Не тянем 'react-native' вообще.
const MockView = React.forwardRef(({ children, ...rest }, ref) =>
  React.createElement('RN_VIEW', { ref, ...rest }, children ?? null)
);
MockView.displayName = 'RN_VIEW(Mock)';

const MockText = React.forwardRef(({ children, ...rest }, ref) =>
  React.createElement('RN_TEXT', { ref, ...rest }, children ?? null)
);
MockText.displayName = 'RN_TEXT(Mock)';

const Button = React.forwardRef(({ children, onPress, testID, ...rest }, ref) =>
  React.createElement(MockView, { ref, onPress, testID, ...rest }, children ?? null)
);
Button.displayName = 'Button(Mock)';

const ButtonText = React.forwardRef(({ children, ...rest }, ref) =>
  React.createElement(MockText, { ref, ...rest }, children ?? null)
);
ButtonText.displayName = 'ButtonText(Mock)';

module.exports = { __esModule: true, Button, ButtonText, default: Button };
