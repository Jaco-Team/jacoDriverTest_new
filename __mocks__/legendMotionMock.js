// __mocks__/legendMotionMock.js
const Passthrough = ({ children }) => children ?? null;

module.exports = {
  // RN-компоненты-анимации просто «пропускаем»
  Motion: Passthrough,
  AnimatePresence: Passthrough,
  createMotionAnimatedComponent: (Comp) => Comp,
  // иногда пакет ещё экспортирует утильки — заглушим
  Easing: {},
  useAnimation: () => ({}),
};
