import React, { ReactNode } from 'react'
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native'
import {
  SafeAreaView,
} from 'react-native-safe-area-context'
import type { Edges } from 'react-native-safe-area-context'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'

const DRAWER_SCREEN_EDGES: Edges = ['right', 'bottom', 'left']

interface ScreenLayoutProps {
  children: ReactNode
  withScroll?: boolean
  style?: StyleProp<ViewStyle>
  safeAreaEdges?: Edges
}

export function ScreenLayout({
  children,
  withScroll = false,
  style,
  safeAreaEdges = DRAWER_SCREEN_EDGES,
}: ScreenLayoutProps) {
  const { colors } = useAppTheme()

  if (withScroll) {
    return (
      <SafeAreaView
        edges={safeAreaEdges}
        style={[styles.safeArea, { backgroundColor: colors.surface }, style]}
        testID="screen-layout-safe-area"
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          testID="screen-layout-scroll"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView
      edges={safeAreaEdges}
      style={[styles.safeArea, { backgroundColor: colors.surface }, style]}
      testID="screen-layout-safe-area"
    >
      <View style={[styles.content, { backgroundColor: colors.surface }]}>
        {children}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  scrollContainer: {
    paddingTop: 16,
  },
})
