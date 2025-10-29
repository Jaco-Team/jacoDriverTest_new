// __mocks__/nativewindMock.js
module.exports = {
  // имитируем vars() так, чтобы на результате были set/get/subscribe
  vars: () => {
    const api = {
      _value: undefined,
      set: (v) => { api._value = v; },              // чтобы вызов .set(mode) не падал
      get: () => api._value,
      subscribe: () => () => {},                    // заглушка отписки
    };
    return api;
  },

  // прочие функции, которые могут дергаться в коде
  cssInterop: () => {},
  styled: (Component) => Component,
};
