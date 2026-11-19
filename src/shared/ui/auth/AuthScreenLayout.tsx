import React, { useMemo } from 'react'
import {
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import Animated from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { ConnectivityLocationIndicator } from '@/shared/ui/ConnectivityLocationIndicator'

import { useKeyboardScroll } from '@/shared/ui/keyboard/useKeyboardScroll'
import { AuthKeyboardContext } from './AuthKeyboardContext'
import { useAuthPalette } from './authPalette'

interface AuthScreenLayoutProps {
  children: React.ReactNode
}

function AuthBackground(): React.JSX.Element {
  const palette = useAuthPalette()

  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      testID="auth-background"
    >
      <Defs>
        <LinearGradient id="auth-base" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={palette.backgroundTop} />
          <Stop offset="1" stopColor={palette.backgroundBottom} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#auth-base)" />
    </Svg>
  )
}

/** Карточка по центру экрана на светлом фоне — как страница входа SSO и ШЭФ. */
export function AuthScreenLayout({ children }: AuthScreenLayoutProps): React.JSX.Element {
  const palette = useAuthPalette()
  const { width } = useWindowDimensions()
  const {
    rootRef, canvasRef, fieldsRef, scrollRef, canvasHeight, spacer,
    onViewportLayout, onContentSizeChange, onScroll, onFocus, onBlur, onFieldsLayout,
  } = useKeyboardScroll(16)
  const keyboard = useMemo(
    () => ({ fieldsRef, onFieldsLayout, onFocus, onBlur }),
    [fieldsRef, onFieldsLayout, onFocus, onBlur]
  )

  return (
    <View style={[styles.root, { backgroundColor: palette.backgroundTop }]} testID="auth-screen-layout">
      <AuthBackground />
      <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
        <ConnectivityLocationIndicator />
        <View ref={rootRef} style={styles.keyboardView} onLayout={onViewportLayout}>
          <Animated.ScrollView
            ref={scrollRef}
            style={styles.keyboardView}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onContentSizeChange={onContentSizeChange}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={false}
            automaticallyAdjustContentInsets={false}
            automaticallyAdjustsScrollIndicatorInsets={false}
            contentInsetAdjustmentBehavior="never"
            scrollsChildToFocus={false}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
          >
            <View
              ref={canvasRef}
              collapsable={false}
              style={[styles.canvas, { minHeight: canvasHeight }]}
              onLayout={onFieldsLayout}
            >
              <View
                style={[
                  styles.card,
                  width >= 600 && styles.cardWide,
                  { backgroundColor: palette.card },
                ]}
                testID="auth-card"
              >
                <AuthKeyboardContext.Provider value={keyboard}>
                  {children}
                </AuthKeyboardContext.Provider>
              </View>
            </View>
            <View style={{ height: spacer }} pointerEvents="none" />
          </Animated.ScrollView>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  canvas: {
    flexShrink: 0,
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: 16,
    borderRadius: 24,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  cardWide: {
    padding: 32,
  },
})
