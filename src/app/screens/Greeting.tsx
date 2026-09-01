import React from 'react'
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useGreetingLogic } from '@/processes/auth/model/useGreetingLogic'

const GREETING_BACKGROUND = '#CC0033'

export function Greeting(): React.JSX.Element {
  useGreetingLogic()

  return (
    <View style={styles.root} testID="greeting-screen">
      <SafeAreaView
        edges={['top', 'right', 'bottom', 'left']}
        style={styles.safeArea}
      >
        <View style={styles.content}>
          <Image
            accessibilityLabel="Логотип Жако"
            resizeMode="contain"
            source={require('@/shared/assets/logo.png')}
            style={styles.logo}
            testID="greeting-logo"
          />

          <Text accessibilityRole="header" style={styles.title}>
            Приложение курьера{`\n`}сети кафе Жако
          </Text>

          <ActivityIndicator
            accessibilityLabel="Проверка авторизации"
            color="#FFFFFF"
            size="large"
            testID="greeting-spinner"
          />
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GREETING_BACKGROUND,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    width: '100%',
    height: '70%',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 24,
  },
  logo: {
    width: 150,
    height: 150,
  },
  title: {
    width: '86%',
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    textAlign: 'center',
  },
})
