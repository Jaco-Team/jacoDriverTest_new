import React, { ReactNode } from 'react'
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native'

interface ScreenLayoutProps {
  children: ReactNode
  withScroll?: boolean     // хотим ли прокрутку
  style?: object           // возможность переопределить стили
}

export function ScreenLayout({
  children,
  withScroll = false,
  style
}: ScreenLayoutProps) {
  if (withScroll) {
    return (
      <SafeAreaView style={[styles.safeArea, style]}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safeArea, style]}>
      <View className='h-full w-full relative bg-gray-50'>
        {children}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5', // например сероватый фон
  },
  container: {
    flex: 1,
    //paddingHorizontal: 16,
    paddingTop: 16,
    // любые другие базовые стили
  },
  scrollContainer: {
    //paddingHorizontal: 16,
    paddingTop: 16,
    // ...
  },
})