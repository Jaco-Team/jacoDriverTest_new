import React from 'react'
import {Pressable, StyleSheet, Text, TouchableOpacity, View} from 'react-native'
import {Sparkles} from 'lucide-react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
} from '@/components/ui/actionsheet'
import {appPalette} from '@/shared/styles/appPalette'
import {useAppTheme} from '@/shared/theme/AppThemeProvider'
import {scaleGlobalFontSize} from '@/shared/lib/fontSize'

interface NoSuitableOrdersSheetProps {
  fontSize: number
  isOpen: boolean
  onClose: () => void
}

export function NoSuitableOrdersSheet({
  fontSize,
  isOpen,
  onClose,
}: NoSuitableOrdersSheetProps): React.JSX.Element | null {
  const {bottom} = useSafeAreaInsets()
  const {colors} = useAppTheme()

  if (!isOpen) return null

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop testID="order-recommendation-empty-backdrop" />
      <ActionsheetContent
        style={[
          styles.sheet,
          {
            borderColor: colors.border,
            backgroundColor: colors.aiSurface,
          },
        ]}
        testID="order-recommendation-empty-sheet"
      >
        <Pressable
          accessibilityLabel="Закрыть рекомендации"
          accessibilityRole="button"
          style={styles.handleButton}
          testID="order-recommendation-empty-handle"
          onPress={onClose}
        >
          <View style={[styles.handle, {backgroundColor: colors.border}]} />
        </Pressable>

        <View style={[styles.body, {paddingBottom: bottom + 20}]}>
          <View style={styles.header}>
            <View style={[styles.iconBox, {backgroundColor: colors.brandSoft}]}>
              <Sparkles color={colors.brand} size={25} strokeWidth={2.25} />
            </View>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                  fontSize: scaleGlobalFontSize(20, fontSize, 18, 24),
                },
              ]}
            >
              Рекомендации по заказам
            </Text>
          </View>

          <Text
            style={[
              styles.message,
              {
                color: colors.textMuted,
                fontSize: scaleGlobalFontSize(16, fontSize, 14, 19),
              },
            ]}
            testID="order-recommendation-empty-message"
          >
            Подходящих заказов для Вас сейчас нет.
          </Text>

          <TouchableOpacity
            activeOpacity={0.78}
            accessibilityRole="button"
            style={[styles.button, {backgroundColor: colors.brand}]}
            testID="order-recommendation-empty-close"
            onPress={onClose}
          >
            <Text style={[styles.buttonText, {fontSize: scaleGlobalFontSize(16, fontSize, 14, 19)}]}>
              Понятно
            </Text>
          </TouchableOpacity>
        </View>
      </ActionsheetContent>
    </Actionsheet>
  )
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    padding: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    backgroundColor: appPalette.surfaceRaised,
  },
  handleButton: {
    width: '100%',
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  body: {
    width: '100%',
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  title: {
    flex: 1,
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    lineHeight: 29,
  },
  message: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    fontFamily: 'Roboto-Regular',
    lineHeight: 24,
  },
  button: {
    minHeight: 48,
    alignSelf: 'stretch',
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    lineHeight: 22,
  },
})
