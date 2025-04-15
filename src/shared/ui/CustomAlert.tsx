import React from "react"

import { TouchableOpacity, View, Text, PanResponder } from 'react-native';

import { VStack } from "@/components/ui/vstack"

import { Icon, CloseIcon } from "@/components/ui/icon"

import { useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import { animated, useSpring } from '@react-spring/native';

const AnimatedView = animated(View);

export function CustomAlert(): React.JSX.Element {

  const [is_show_alert_text, modal_text, showAlertText, globalFontSize] = useGlobalStore(useShallow( state => [ state.is_show_alert_text, state.modal_text, state.showAlertText, state.globalFontSize ]));

  const styles = useSpring({
    from: { translateY: -200, opacity: 0 },
    to: { translateY: is_show_alert_text ? 70 : -100, opacity: 1 },
    config: { tension: 200, friction: 20 },
  });

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy < -20) {
        showAlertText(false)
      }
    },
  });

  return (
    <AnimatedView
      {...panResponder.panHandlers}
      style={[
        {
          transform: [{ translateY: styles.translateY }],
          opacity: styles.opacity,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          borderRadius: 4,
          zIndex: 50
        },
      ]}
    >
      <VStack className="gap-4 flex-row justify-between pl-5 pr-5 pt-3 pb-3 rounded-lg flex-1 items-center w-auto mr-5 ml-5" style={{ backgroundColor: "#44944a" }}>
        <Text className="font-semibold text-white w-11/12" style={{ fontSize: globalFontSize }}>
          {modal_text}
        </Text>

        <TouchableOpacity onPress={() => { showAlertText(false) }} className="w-1/12">
          <Icon color="white" as={CloseIcon} />
        </TouchableOpacity>
      </VStack>
    </AnimatedView>
  );
}