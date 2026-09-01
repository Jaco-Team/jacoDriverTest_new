import React from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'

interface AuthScreenLayoutProps {
  children: React.ReactNode
}

function AuthBackground(): React.JSX.Element {
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      testID="auth-background"
    >
      <Defs>
        <LinearGradient id="auth-base" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F4F7FA" />
          <Stop offset="0.46" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#F7F9FB" />
        </LinearGradient>
        <RadialGradient id="auth-top-glow" cx="0" cy="0" rx="1" ry="1">
          <Stop offset="0" stopColor="#315C7A" stopOpacity="0.14" />
          <Stop offset="1" stopColor="#315C7A" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="auth-bottom-glow" cx="1" cy="1" rx="1" ry="1">
          <Stop offset="0" stopColor="#1F3D56" stopOpacity="0.08" />
          <Stop offset="1" stopColor="#1F3D56" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect width="100%" height="100%" fill="url(#auth-base)" />
      <Circle cx="0" cy="40" r="230" fill="url(#auth-top-glow)" />
      <Circle cx="100%" cy="100%" r="270" fill="url(#auth-bottom-glow)" />
    </Svg>
  )
}

export function AuthScreenLayout({ children }: AuthScreenLayoutProps): React.JSX.Element {
  return (
    <View style={styles.root} testID="auth-screen-layout">
      <AuthBackground />

      <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card} testID="auth-card">
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FA',
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingRight: 14,
    paddingBottom: 24,
    paddingLeft: 14,
  },
  card: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingTop: 24,
    paddingRight: 20,
    paddingBottom: 24,
    paddingLeft: 20,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    borderWidth: 1,
    borderColor: 'rgba(37, 18, 22, 0.08)',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#181114',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
  },
})
