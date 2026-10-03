import React, { useEffect, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useShallow } from 'zustand/react/shallow'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet'
import { useGlobalStore } from '@/shared/store/store'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'

function clampFontSize(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function ModalText(): React.JSX.Element {
  const [isOpen, modalText, showModalText, globalFontSize] = useGlobalStore(
    useShallow(state => [
      state.is_show_modal_text,
      state.modal_text,
      state.showModalText,
      state.globalFontSize,
    ]),
  )
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const lastOpenText = useRef('')

  useEffect(() => {
    if (isOpen) lastOpenText.current = modalText || ''
  }, [isOpen, modalText])

  const message = (isOpen ? modalText : lastOpenText.current) || 'Произошла неизвестная ошибка'
  const isOffline = message.startsWith('Нет интернета.')
  const body = isOffline ? message.slice('Нет интернета.'.length).trim() : message
  const titleFontSize = clampFontSize(globalFontSize + 4, 18, 24)
  const bodyFontSize = clampFontSize(globalFontSize, 14, 18)
  const actionFontSize = clampFontSize(globalFontSize + 1, 14, 18)
  const close = () => showModalText(false)

  return (
    <Actionsheet isOpen={isOpen} onClose={close}>
      <ActionsheetBackdrop />
      <ActionsheetContent
        style={[styles.sheet, {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          paddingBottom: insets.bottom + 28,
        }]}
        testID="message-modal-sheet"
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator style={styles.handleArea}>
            <Pressable
              accessibilityLabel="Закрыть сообщение"
              accessibilityRole="button"
              style={styles.handlePressable}
              onPress={close}
            >
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
            </Pressable>
          </ActionsheetDragIndicator>
        </ActionsheetDragIndicatorWrapper>

        <View style={styles.headingRow} testID="message-modal">
          <View style={[styles.iconBox, { backgroundColor: colors.brandSoft }]}>
            <MaterialIcons
              color={colors.brand}
              name={isOffline ? 'wifi-off' : 'error-outline'}
              size={24}
            />
          </View>
          <Text
            style={[styles.title, {
              color: colors.text,
              fontSize: titleFontSize,
              lineHeight: Math.round(titleFontSize * 1.2),
            }]}
          >
            {isOffline ? 'Нет интернета' : 'Внимание'}
          </Text>
        </View>

        <ScrollView style={styles.messageScroll} showsVerticalScrollIndicator={false}>
          <Text
            style={[styles.message, {
              color: colors.textMuted,
              fontSize: bodyFontSize,
              lineHeight: Math.round(bodyFontSize * 1.45),
            }]}
            testID="message-modal-body"
          >
            {body}
          </Text>
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          style={[styles.actionButton, { backgroundColor: colors.brand }]}
          testID="message-modal-close"
          onPress={close}
        >
          <Text style={[styles.actionText, { fontSize: actionFontSize }]}>Понятно</Text>
        </Pressable>
      </ActionsheetContent>
    </Actionsheet>
  )
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '75%',
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 9,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
  },
  handleArea: { width: '100%', height: 22, backgroundColor: 'transparent' },
  handlePressable: {
    width: '100%',
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: { width: 62, height: 6, borderRadius: 999 },
  headingRow: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  iconBox: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  title: { flex: 1, fontFamily: 'Roboto-Bold' },
  messageScroll: { width: '100%', maxHeight: 320 },
  message: { width: '100%', alignSelf: 'stretch', marginBottom: 20, fontFamily: 'Roboto-Regular' },
  actionButton: {
    width: '100%',
    height: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 8,
  },
  actionText: { color: '#FFFFFF', fontFamily: 'Roboto-Bold', lineHeight: 21 },
})
