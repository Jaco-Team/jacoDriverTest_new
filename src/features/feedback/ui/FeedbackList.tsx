import React from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { appPalette } from '@/shared/styles/appPalette'
import { useFeedbackStore } from '@/shared/store/store'
import type { FeedbackResponse } from '@/shared/store/FeedbackStoreType'

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
  const [fetchFeedbacks, fetchFeedbackById] = useFeedbackStore(
    useShallow(state => [state.fetchFeedbacks, state.fetchFeedbackById]),
  )

  React.useEffect(() => {
    void fetchFeedbacks()
  }, [fetchFeedbacks])

  return (
    <FlatList
      contentContainerStyle={[
        styles.content,
        feedbacks.length === 0 && styles.emptyContent,
      ]}
      data={feedbacks}
      keyExtractor={item => String(item.id)}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={[styles.emptyTitle, { fontSize: Math.min(28, globalFontSize + 3) }]}>Ничего не найдено</Text>
          <Text style={[styles.emptyText, { fontSize: Math.max(14, globalFontSize) }]}>
            Попробуйте изменить фильтр или текст поиска
          </Text>
        </View>
      }
      onRefresh={() => void fetchFeedbacks()}
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
