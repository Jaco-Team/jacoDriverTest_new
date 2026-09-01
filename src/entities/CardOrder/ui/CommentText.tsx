import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Phone } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet'
import { Analytics, AnalyticsEvent } from '@/analytics/AppMetricaService'
import { CommentTextProps } from '@/entities/CardOrder/model/types'
import { appPalette } from '@/shared/styles/appPalette'
import {
  extractPhonesFromText,
  type ExtractedPhone,
} from '@/shared/lib/extractPhonesFromText'

function clampFontSize(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export const CommentText: React.FC<CommentTextProps> = ({
  comment,
  globalFontSize,
  dialCall,
  textColor = appPalette.text,
}) => {
  const insets = useSafeAreaInsets()
  const phones = useMemo(() => extractPhonesFromText(comment), [comment])
  const [phonesOpen, setPhonesOpen] = useState(false)
  const titleFontSize = clampFontSize(globalFontSize + 4, 18, 24)
  const actionFontSize = clampFontSize(globalFontSize + 1, 14, 18)

  useEffect(() => {
    if (phones.length < 2) {
      setPhonesOpen(false)
    }
  }, [phones.length])

  function callPhone(phone: ExtractedPhone): void {
    Analytics.log(
      AnalyticsEvent.OrderCallClient,
      'Звонок клиенту из комментария',
    )
    dialCall(phone.tel)
  }

  function handlePhoneControl(): void {
    if (phones.length === 1) {
      callPhone(phones[0])
      return
    }

    if (phones.length > 1) {
      Analytics.log(
        AnalyticsEvent.OrderCommentPhonesOpen,
        'Открытие номеров из комментария',
      )
      setPhonesOpen(true)
    }
  }

  return (
    <>
      <View style={styles.row} testID="comment-row">
        <Text style={styles.comment}>
          <Text
            style={[
              styles.label,
              {
                color: textColor,
                fontSize: globalFontSize,
                lineHeight: globalFontSize + 6,
              },
            ]}
          >
            Комментарий:{' '}
          </Text>
          <Text
            style={[
              styles.value,
              {
                color: textColor,
                fontSize: globalFontSize,
                lineHeight: globalFontSize + 6,
              },
            ]}
          >
            {comment}
          </Text>
        </Text>

        {phones.length > 0 ? (
          <Pressable
            accessibilityLabel={
              phones.length === 1
                ? `Позвонить ${phones[0].display}`
                : 'Выбрать номер из комментария'
            }
            accessibilityRole="button"
            hitSlop={8}
            style={styles.phoneButton}
            testID="order-card-comment-call"
            onPress={handlePhoneControl}
          >
            <Phone color={appPalette.primary} size={24} strokeWidth={2} />
            {phones.length > 1 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{phones.length}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      {phones.length > 1 ? (
        <Actionsheet
          isOpen={phonesOpen}
          onClose={() => setPhonesOpen(false)}
        >
          <ActionsheetBackdrop />
          <ActionsheetContent
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 28 },
            ]}
            testID="order-card-comment-phones-drawer"
          >
            <ActionsheetDragIndicatorWrapper>
              <ActionsheetDragIndicator style={styles.handleArea}>
                <Pressable
                  accessibilityLabel="Закрыть выбор номера"
                  accessibilityRole="button"
                  style={styles.handlePressable}
                  onPress={() => setPhonesOpen(false)}
                >
                  <View style={styles.handle} />
                </Pressable>
              </ActionsheetDragIndicator>
            </ActionsheetDragIndicatorWrapper>

            <Text
              style={[
                styles.sheetTitle,
                {
                  fontSize: titleFontSize,
                  lineHeight: Math.round(titleFontSize * 1.2),
                },
              ]}
            >
              Позвонить
            </Text>

            <View style={styles.phoneOptions}>
              {phones.map((phone) => (
                <Pressable
                  accessibilityLabel={`Позвонить ${phone.display}`}
                  accessibilityRole="button"
                  key={phone.digits}
                  style={styles.phoneOption}
                  testID={`order-card-comment-phone-${phone.digits}`}
                  onPress={() => {
                    callPhone(phone)
                    setPhonesOpen(false)
                  }}
                >
                  <Text
                    style={[
                      styles.phoneOptionText,
                      { fontSize: actionFontSize },
                    ]}
                  >
                    {phone.display}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ActionsheetContent>
        </Actionsheet>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comment: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: 'Roboto-Medium',
  },
  value: {
    fontFamily: 'Roboto-Regular',
  },
  phoneButton: {
    position: 'relative',
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: appPalette.soft,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: appPalette.brand,
  },
  badgeText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontSize: 11,
    lineHeight: 14,
  },
  sheet: {
    maxHeight: '75%',
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 9,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: appPalette.softStrong,
    backgroundColor: '#FFFFFF',
  },
  handleArea: {
    width: '100%',
    height: 22,
    backgroundColor: 'transparent',
  },
  handlePressable: {
    width: '100%',
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 62,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(31, 43, 54, 0.2)',
  },
  sheetTitle: {
    marginBottom: 16,
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
  },
  phoneOptions: {
    width: '100%',
    gap: 8,
  },
  phoneOption: {
    width: '100%',
    height: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  phoneOptionText: {
    color: appPalette.text,
    fontFamily: 'Roboto-Medium',
    lineHeight: 21,
  },
})
