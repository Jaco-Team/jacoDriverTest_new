// __mocks__/reactSpringNativeMock.js
const React = require('react');
const rn = require('react-native');

const wrap = (Base) =>
  React.forwardRef((props, ref) =>
    React.createElement(Base || 'div', { ref, ...props }, props?.children)
  );

// callable: animated(View)
function animated(Base) {
  return wrap(Base);
}

// также поддерживаем неймспейсный стиль: animated.View / animated.Text / …
['View', 'Text', 'ScrollView', 'Image', 'Pressable', 'TouchableOpacity', 'SafeAreaView']
  .forEach((name) => {
    const Comp = rn?.[name] || 'div';
    animated[name] = wrap(Comp);
  });

// базовые хуки/объекты
const useSpring = () => ({});
const useSprings = () => [];
const useTransition = () => [];
const config = {};
const a = animated; // web-алиас, иногда так импортируют

module.exports = {
  __esModule: true,
  animated,
  a,
  useSpring,
  useSprings,
  useTransition,
  config,
  default: { animated, a, useSpring, useSprings, useTransition, config },
};

