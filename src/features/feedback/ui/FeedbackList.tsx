import React from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { appPalette } from '@/shared/styles/appPalette'
import { useFeedbackStore } from '@/shared/store/store'
import type { FeedbackResponse } from '@/shared/store/FeedbackStoreType'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'
import { useIsOffline } from '@/shared/ui/ConnectivityLocationIndicator'
import { useOnlineScreenRefresh } from '@/shared/lib/useOnlineScreenRefresh'
import { useScrollToTopOnFocus } from '@/shared/lib/useScrollToTopOnFocus'

import FeedbackItem from './FeedbackItem'

type FeedbackListProps = {
  feedbacks: FeedbackResponse[]
  globalFontSize: number
  onDismissKeyboard: () => void
}

const FeedbackList: React.FC<FeedbackListProps> = ({
  feedbacks,
  globalFontSize,
  onDismissKeyboard,
}) => {
  const { colors } = useAppTheme()
  const isOffline = useIsOffline()
  const scrollRef = useScrollToTopOnFocus<FlatList<FeedbackResponse>>()
  const [fetchFeedbacks, fetchFeedbackById, error] = useFeedbackStore(
    useShallow(state => [
      state.fetchFeedbacks,
      state.fetchFeedbackById,
      state.error,
    ]),
  )

  useOnlineScreenRefresh(isOffline, fetchFeedbacks)

  return (
    <FlatList
      ref={scrollRef}
      contentContainerStyle={[
        styles.content,
        feedbacks.length === 0 && styles.emptyContent,
      ]}
      data={feedbacks}
      keyExtractor={item => String(item.id)}
      ListEmptyComponent={
        <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
          <Text style={[styles.emptyTitle, { color: colors.text, fontSize: Math.min(28, globalFontSize + 3) }]}>
            {!isOffline && error ? 'Не удалось загрузить данные' : 'Ничего не найдено'}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textMuted, fontSize: Math.max(14, globalFontSize) }]}>
            {!isOffline && error ? error : 'Попробуйте изменить фильтр или текст поиска'}
          </Text>
        </View>
      }
      onRefresh={isOffline ? undefined : () => void fetchFeedbacks()}
      onScrollBeginDrag={onDismissKeyboard}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="never"
      refreshing={false}
      removeClippedSubviews
      renderItem={({ item }) => (
        <FeedbackItem
          feedback={item}
          globalFontSize={globalFontSize}
          onPress={() => {
            onDismissKeyboard()
            void fetchFeedbackById(item.id)
          }}
        />
      )}
      showsVerticalScrollIndicator={false}
      testID="feedback-list"
    />
  )
}

export default FeedbackList

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 112,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyCard: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 36,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: appPalette.border,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    marginBottom: 6,
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
  },
  emptyText: {
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Regular',
    lineHeight: 22,
    textAlign: 'center',
  },
})
