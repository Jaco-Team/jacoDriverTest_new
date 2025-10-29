// __mocks__/gluestackNativewindUtilsMock.js

function makeStore() {
  const store = { _v: undefined };
  return {
    set: (v) => { store._v = v; },
    get: () => store._v,
    subscribe: () => () => {},
  };
}

// HOC-заглушка — просто возвращает тот же компонент
function withStyleContext(Component /*, scope */) {
  return Component;
}

// tva — должна быть функцией, возвращающей резолвер
function tva() {
  const resolver = () => ({});
  resolver.split = () => resolver;
  return resolver;
}

// --- ключевые сторы, которые ждёт твой провайдер ---
const colorScheme = makeStore();
const colorSchemeNW = colorScheme;   // алиас, чтобы оба имени работали

const api = {
  // иногда библиотека ждёт фабрику vars(), оставим её тоже
  vars: () => makeStore(),
  styled: (C) => C,
  cssInterop: () => {},
  tva,
  createStyle: () => ({}),
  createConfig: () => ({}),
  withStyleContext,

  // ВАЖНО: экспортируем сторы как именованные
  colorScheme,
  colorSchemeNW,
};

// Экспортируем и default, и named — на любые варианты импортов
module.exports = {
  ...api,
  default: api,
};


