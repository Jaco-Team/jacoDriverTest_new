// __mocks__/expoHtmlElementsMock.js
const React = require('react');
const Passthrough = ({ children }) => React.createElement(React.Fragment, null, children);

// Экспортируем то, что ты используешь (H1..H6). Можно добавить P, A и т.п. при необходимости.
module.exports = {
  H1: Passthrough,
  H2: Passthrough,
  H3: Passthrough,
  H4: Passthrough,
  H5: Passthrough,
  H6: Passthrough,
};
