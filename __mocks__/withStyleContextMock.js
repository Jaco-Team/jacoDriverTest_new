// __mocks__/withStyleContextMock.js
module.exports = function withStyleContext(Component /*, scope */) {
  // Возвращаем HOC-обертку-«пустышку»
  return Component;
};
