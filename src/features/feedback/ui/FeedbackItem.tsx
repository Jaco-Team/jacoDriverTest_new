import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { CalendarDays } from 'lucide-react-native'

import { appPalette } from '@/shared/styles/appPalette'
import type { FeedbackResponse } from '@/shared/store/FeedbackStoreType'

import { StatusBadge } from './StatusBadge'

interface FeedbackItemProps {
  feedback: FeedbackResponse
  globalFontSize: number
  onPress: () => void
}

export function formatFeedbackDate(value: Date | string | null | undefined): string {
  if (!value) return '—'

  const source = String(value)
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}.${match[2]}.${match[1]}`

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('ru-RU')
}

const FeedbackItem: React.FC<FeedbackItemProps> = ({ feedback, globalFontSize, onPress }) => {
  const title = String(feedback.title ?? '').trim() || 'Без заголовка'
  const description = String(feedback.description ?? '').trim() || 'Нет описания'
  const compact = title.length <= 24 && description.length <= 40

  const titleFontSize = Math.min(30, Math.max(18, globalFontSize + 5))
  const descriptionFontSize = Math.min(24, Math.max(14, globalFontSize))

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.card,
        compact ? styles.cardCompact : styles.cardRegular,
      ]}
      testID={`feedback-card-${feedback.id}`}
    >
      <Text
        numberOfLines={2}
        style={[styles.title, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.22) }]}
      >
        {title}
      </Text>
      <Text
        numberOfLines={4}
        style={[styles.description, { fontSize: descriptionFontSize, lineHeight: Math.round(descriptionFontSize * 1.45) }]}
      >
        {description}
      </Text>

      <View style={styles.footer}>
        <StatusBadge status={feedback.status} globalFontSize={globalFontSize - 2} />
        <View style={styles.date}>
          <CalendarDays color={appPalette.textMuted} size={Math.max(14, globalFontSize - 2)} />
          <Text style={[styles.dateText, { fontSize: Math.min(20, Math.max(12, globalFontSize - 2)) }]}>
            {formatFeedbackDate(feedback.date_time_create)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

export default FeedbackItem

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: appPalette.border,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1F2B36',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardCompact: { minHeight: 172 },
  cardRegular: { minHeight: 198 },
  title: { marginBottom: 9, color: appPalette.text, fontFamily: 'Roboto-Bold' },
  description: {
    flexShrink: 1,
    marginBottom: 10,
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Regular',
  },
  footer: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: appPalette.border,
  },
  date: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { color: appPalette.textMuted, fontFamily: 'Roboto-Medium', lineHeight: 16 },
})
