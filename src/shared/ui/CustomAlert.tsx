import React from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { CircleCheck, CircleX, TriangleAlert, X } from 'lucide-react-native'

import { useShallow } from 'zustand/react/shallow'
import { animated, useSpring } from '@react-spring/native'

import { useGlobalStore } from '@/shared/store/store'

const AnimatedView = animated(View)

export function CustomAlert({ bannerRef }: { bannerRef?: React.Ref<View> }): React.JSX.Element {
  const [is_show_alert_text, modal_text, showAlertText, globalFontSize, alertSeverity] = useGlobalStore(
    useShallow(state => [
      state.is_show_alert_text,
      state.modal_text,
      state.showAlertText,
      state.globalFontSize,
      state.alertSeverity,
    ]),
  )
  const isSuccess = !alertSeverity || alertSeverity === 'success'
  const alertColor = '#ffffff'
  const backgroundColor = isSuccess
    ? '#4CAF50'
    : alertSeverity === 'warning' ? '#ed6c02' : '#d32f2f'

  const animation = useSpring({
    from: { translateY: -200, opacity: 0 },
    to: { translateY: is_show_alert_text ? 70 : -100, opacity: 1 },
    config: { tension: 200, friction: 20 },
  });

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) =>
      gestureState.dy < -12 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy < -20) showAlertText(false)
    },
  });

  return (
    <AnimatedView
      {...panResponder.panHandlers}
      testID="custom-alert-container"
      pointerEvents={is_show_alert_text ? 'auto' : 'none'}
      style={[
        {
          transform: [{ translateY: animation.translateY }],
          opacity: animation.opacity,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          elevation: 50,
        },
      ]}
    >
      <View ref={bannerRef} style={[styles.banner, { backgroundColor }]}>
        {isSuccess ? (
          <CircleCheck color={alertColor} size={21} strokeWidth={2.4} />
        ) : alertSeverity === 'warning' ? (
          <TriangleAlert color={alertColor} size={21} strokeWidth={2.4} />
        ) : (
          <CircleX color={alertColor} size={21} strokeWidth={2.4} />
        )}
        <Text style={[styles.message, { fontSize: globalFontSize, color: alertColor }]} numberOfLines={3}>
          {modal_text}
        </Text>
        <Pressable
          accessibilityLabel="Закрыть сообщение"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => showAlertText(false)}
          style={styles.closeButton}
          testID="custom-alert-close"
        >
          <X color={alertColor} size={21} strokeWidth={2} />
        </Pressable>
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 52,
    marginHorizontal: 8,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  message: {
    flex: 1,
    minWidth: 0,
    color: '#ffffff',
    fontFamily: 'Roboto-Medium',
    lineHeight: 22,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
