import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { FeedbackResponse } from '@/shared/store/FeedbackStoreType'

export type FeedbackStatusVariant = 'new' | 'progress' | 'rejected' | 'resolved'

export function getFeedbackStatusVariant(status: FeedbackResponse['status']): FeedbackStatusVariant {
  switch (String(status).trim().toLocaleLowerCase('ru')) {
    case 'новое':
      return 'new'
    case 'в работе':
      return 'progress'
    case 'решено':
      return 'resolved'
    case 'отклонено':
    default:
      return 'rejected'
  }
}

export function getFeedbackStatusColors(status: FeedbackResponse['status']): { background: string; text: string } {
  switch (getFeedbackStatusVariant(status)) {
    case 'new':
      return { background: '#42AAFF', text: '#FFFFFF' }
    case 'progress':
      return { background: '#FFECCF', text: '#253343' }
    case 'resolved':
      return { background: '#DFF6DF', text: '#1F6B2A' }
    case 'rejected':
    default:
      return { background: '#ECEFF3', text: '#253343' }
  }
}

function getStatusStyle(status: FeedbackResponse['status']) {
  switch (getFeedbackStatusVariant(status)) {
    case 'new':
      return [styles.newBadge, styles.newText] as const
    case 'progress':
      return [styles.progressBadge, styles.darkText] as const
    case 'resolved':
      return [styles.resolvedBadge, styles.resolvedText] as const
    case 'rejected':
    default:
      return [styles.rejectedBadge, styles.darkText] as const
  }
}

function getStatusLabel(status: FeedbackResponse['status']): string {
  switch (getFeedbackStatusVariant(status)) {
    case 'new':
      return 'Новое'
    case 'progress':
      return 'В работе'
    case 'resolved':
      return 'Решено'
    case 'rejected':
    default:
      return 'Отклонено'
  }
}

/*
 * Цвета ниже намеренно заданы отдельными StyleSheet-правилами: это точные
 * значения FeedbackCard сайта, а не Tailwind-приближения bg-*-100.
 */
export const StatusBadge: React.FC<{
  status: FeedbackResponse['status']
  globalFontSize: number
  size?: 'card' | 'details'
}> = ({ status, globalFontSize, size = 'card' }) => {
  const [badgeStyle, textStyle] = getStatusStyle(status)
  const fontSize = Math.min(19, Math.max(12, globalFontSize))

  return (
    <View
      style={[styles.badge, size === 'details' && styles.detailsBadge, badgeStyle]}
      testID={`feedback-status-badge-${getFeedbackStatusVariant(status)}`}
    >
      <Text style={[styles.text, textStyle, { fontSize, lineHeight: fontSize }]}>
        {getStatusLabel(status)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  detailsBadge: { height: 32 },
  newBadge: { backgroundColor: '#42AAFF' },
  progressBadge: { backgroundColor: '#FFECCF' },
  rejectedBadge: { backgroundColor: '#ECEFF3' },
  resolvedBadge: { backgroundColor: '#DFF6DF' },
  text: { fontFamily: 'Roboto-Bold' },
  newText: { color: '#FFFFFF' },
  darkText: { color: '#253343' },
  resolvedText: { color: '#1F6B2A' },
})
