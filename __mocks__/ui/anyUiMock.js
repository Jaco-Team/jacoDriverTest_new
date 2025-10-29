// __mocks__/ui/anyUiMock.js
const React = require('react');

function make(name) {
  const C = React.forwardRef((props, ref) =>
    React.createElement('div', { ref, 'data-ui': String(name), ...props }, props?.children)
  );
  C.displayName = `UI(${String(name)})`;
  return C;
}

// default-компонент на всякий случай
const Default = make('Default');

const proxy = new Proxy(
  { __esModule: true, default: Default },
  {
    get(target, key) {
      if (key in target) return target[key];
      const Comp = make(key);
      // кэшируем, чтобы след. доступ к этому имени шёл без Proxy
      target[key] = Comp;
      return Comp;
    },
  }
);

module.exports = proxy;
