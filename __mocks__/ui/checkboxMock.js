const React = require('react');

const as = (tag, name) =>
  React.forwardRef((props, ref) =>
    React.createElement(tag, { ref, 'data-ui': name, ...props }, props?.children)
  );

const Checkbox = as('label', 'Checkbox');
const CheckboxIndicator = as('span', 'CheckboxIndicator');
const CheckboxIcon = as('span', 'CheckboxIcon');
const CheckboxLabel = as('span', 'CheckboxLabel');

module.exports = {
  __esModule: true,
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckboxLabel,
  default: Checkbox,
};
