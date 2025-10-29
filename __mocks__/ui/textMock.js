// const React = require('react');
// const Text = React.forwardRef((p, ref) => React.createElement('span', { ...p, ref }, p.children));
// module.exports = { __esModule: true, default: Text, Text };

const React = require('react');
const { Text } = require('react-native');

const UIText = React.forwardRef(({ children, ...rest }, ref) =>
  React.createElement(Text, { ref, ...rest }, children ?? null)
);
UIText.displayName = 'Text(Mock)';

module.exports = { __esModule: true, Text: UIText, default: UIText };
