// __mocks__/lucideReactNativeMock.js
const React = require('react');

const cache = Object.create(null);
function stub(name) {
  if (cache[name]) return cache[name];
  const C = React.forwardRef((props, ref) => null);
  C.displayName = `Lucide.${name}`;
  cache[name] = C;
  return C;
}

// Возвращаем заглушку для любого запрошенного имени:
// import { Phone, QrCode } from 'lucide-react-native' -> оба будут компонентами
module.exports = new Proxy({ __esModule: true, default: {} }, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return stub(String(prop));
  },
});


