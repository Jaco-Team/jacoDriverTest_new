import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

interface AuthCaptchaPlaceholderProps {
  testID: string
}

export function AuthCaptchaPlaceholder({
  testID,
}: AuthCaptchaPlaceholderProps): React.JSX.Element {
  return (
    <View
      accessible
      accessibilityLabel="CAPTCHA — визуальная заглушка без проверки"
      accessibilityState={{ disabled: true }}
      style={styles.container}
      testID={testID}
    >
      <View style={styles.checkbox} />

      <View style={styles.content}>
        <Text style={styles.title}>Я не робот</Text>
        <Text style={styles.description}>Нажмите, чтобы продолжить</Text>
        <Text style={styles.brand}>Yandex SmartCaptcha</Text>
      </View>

      <View style={styles.help}>
        <Text style={styles.helpText}>?</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    minHeight: 120,
    marginTop: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(31, 61, 86, 0.18)',
    borderRadius: 16,
    backgroundColor: 'rgba(250, 252, 254, 0.96)',
  },
  checkbox: {
    width: 30,
    height: 30,
    marginRight: 14,
    borderWidth: 2,
    borderColor: 'rgba(104, 116, 125, 0.38)',
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  content: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    color: '#1F1015',
    fontFamily: 'Roboto-Medium',
    fontSize: 16,
    lineHeight: 22,
  },
  description: {
    marginTop: 3,
    color: 'rgba(53, 38, 43, 0.72)',
    fontFamily: 'Roboto-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  brand: {
    marginTop: 10,
    color: 'rgba(53, 38, 43, 0.58)',
    fontFamily: 'Roboto-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  help: {
    width: 20,
    height: 20,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#68747D',
    borderRadius: 10,
  },
  helpText: {
    color: '#68747D',
    fontFamily: 'Roboto-Bold',
    fontSize: 12,
    lineHeight: 14,
  },
})
