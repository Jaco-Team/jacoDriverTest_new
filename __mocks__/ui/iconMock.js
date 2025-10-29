// const React = require('react');

// // отдадим прокси, чтобы любой импортируемый Icon был валиден
// const makeIcon = (name) =>
//   React.forwardRef((props, ref) =>
//     React.createElement('span', { ref, 'data-ui-icon': name, ...props }, props?.children)
//   );

// const handler = {
//   get: (_t, prop) => makeIcon(String(prop)),
// };

// const Icons = new Proxy({}, handler);

// // часто используют CheckIcon
// const CheckIcon = Icons.CheckIcon;

// module.exports = {
//   __esModule: true,
//   ...Icons,
//   CheckIcon,
//   default: Icons,
// };


// __mocks__/ui/iconMock.js
const React = require('react');

function mk(name) {
  const C = React.forwardRef(() => null);
  C.displayName = `${String(name)}(IconMock)`;
  return C;
}

const Icon = mk('Icon');

// Возвращаем валидный компонент для ЛЮБОГО имени: CheckIcon, Phone, X, Ban и т.п.
const proxy = new Proxy(
  { __esModule: true, Icon, default: Icon },
  {
    get(target, key) {
      if (key in target) return target[key];
      // на любое неизвестное имя — мок-компонент
      const comp = mk(key);
      target[key] = comp; // кэшируем
      return comp;
    },
  }
);

module.exports = proxy;
