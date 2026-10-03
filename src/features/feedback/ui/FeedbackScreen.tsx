import React from 'react'
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Plus, Search, X } from 'lucide-react-native'
import { useShallow } from 'zustand/react/shallow'

import { appPalette } from '@/shared/styles/appPalette'
import { useFeedbackStore, useGlobalStore } from '@/shared/store/store'
import type { FeedbackStatus } from '@/shared/store/FeedbackStoreType'
import { ScreenLayout } from '@/shared/ui/ScreenLayout'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'
import { useIsOffline } from '@/shared/ui/ConnectivityLocationIndicator'

import CreateFeedbackModal from './CreateFeedbackModal'
import FeedbackList from './FeedbackList'
import ViewFeedbackModal from './ViewFeedbackModal'

const STATUS_OPTIONS: Array<{ value: FeedbackStatus; label: string }> = [
  { value: '', label: 'Все' },
  { value: 'Новое', label: 'Новое' },
  { value: 'В работе', label: 'В работе' },
  { value: 'Отклонено', label: 'Отклонено' },
  { value: 'Решено', label: 'Решено' },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export const FeedbackScreen: React.FC = () => {
  const { colors, isDark } = useAppTheme()
  const isOffline = useIsOffline()
  const globalFontSize = useGlobalStore(state => state.globalFontSize)
  const [isSearchFocused, setIsSearchFocused] = React.useState(false)
  const searchInputRef = React.useRef<TextInput>(null)
  const [
    feedbacks,
    modal,
    openCreateModal,
    closeCreateModal,
    closeViewModal,
    chooseStatus,
    setStatus,
    searchQuery,
    setSearchQuery,
  ] = useFeedbackStore(
    useShallow(state => [
      state.feedbacks,
      state.modal,
      state.openCreateModal,
      state.closeCreateModal,
      state.closeViewModal,
      state.chooseStatus,
      state.setStatus,
      state.searchQuery,
      state.setSearchQuery,
    ]),
  )

  React.useEffect(() => {
    if (isOffline && modal.isCreateModalOpen) closeCreateModal()
    if (isOffline && modal.isViewModalOpen) closeViewModal()
  }, [closeCreateModal, closeViewModal, isOffline, modal.isCreateModalOpen, modal.isViewModalOpen])

  const normalizedFontSize = Number.isFinite(globalFontSize) && globalFontSize > 0
    ? globalFontSize
    : 16
  const chipFontSize = clamp(normalizedFontSize - 1, 13, 19)
  const filteredFeedbacks = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ru')

    return feedbacks.filter(feedback => {
      const title = String(feedback.title ?? '').toLocaleLowerCase('ru')
      const description = String(feedback.description ?? '').toLocaleLowerCase('ru')
      const matchesSearch = !normalizedQuery
        || title.includes(normalizedQuery)
        || description.includes(normalizedQuery)
      const matchesStatus = !chooseStatus || feedback.status === chooseStatus

      return matchesSearch && matchesStatus
    })
  }, [chooseStatus, feedbacks, searchQuery])

  const selectedStatusLabel = STATUS_OPTIONS.find(option => option.value === chooseStatus)?.label ?? 'Все'
  const isModalOpen = modal.isCreateModalOpen || modal.isViewModalOpen
  const dismissSearch = React.useCallback(() => {
    if (typeof searchInputRef.current?.blur === 'function') {
      searchInputRef.current.blur()
    }
    Keyboard.dismiss()
    setIsSearchFocused(false)
  }, [])

  return (
    <ScreenLayout>
      <Pressable
        accessible={false}
        onPress={dismissSearch}
        style={[styles.screen, { backgroundColor: colors.surface }]}
        testID="feedback-screen"
      >
        <View style={[styles.filtersCard, { borderColor: colors.border, backgroundColor: colors.surfaceRaised, shadowColor: colors.shadowStrong }]} testID="feedback-filters-card">
          <View style={styles.filtersHeading}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontSize: clamp(normalizedFontSize + 2, 16, 26) }]}>Статус</Text>
            <Text style={[styles.selectedStatus, { color: colors.textMuted, fontSize: clamp(normalizedFontSize - 1, 12, 20) }]}>
              Выбрано: {selectedStatusLabel}
            </Text>
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={styles.statusList}
            showsHorizontalScrollIndicator={false}
          >
            {STATUS_OPTIONS.map(option => {
              const selected = chooseStatus === option.value

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option.label}
                  onPress={() => {
                    dismissSearch()
                    setStatus(option.value)
                  }}
                  style={[
                    styles.statusChip,
                    {
                      borderColor: selected ? colors.brand : colors.border,
                      backgroundColor: selected ? colors.brand : colors.surfaceRaised,
                    },
                  ]}
                  testID={`feedback-status-${option.value || 'all'}`}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      selected && styles.statusChipTextSelected,
                      { color: selected ? '#FFFFFF' : colors.text, fontSize: chipFontSize },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          <View
            style={[
              styles.searchBox,
              { borderColor: colors.border, backgroundColor: colors.surfaceRaised },
              isSearchFocused && styles.searchBoxFocused,
              isSearchFocused && { borderColor: isDark ? colors.primary : '#3F5F7B' },
            ]}
            testID="feedback-search-box"
          >
            <Search color={colors.textMuted} size={22} strokeWidth={2} />
            <TextInput
              accessibilityLabel="Поиск отзывов"
              autoCorrect={false}
              onBlur={() => setIsSearchFocused(false)}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Поиск по заголовку и описанию"
              placeholderTextColor={colors.textMuted}
              ref={searchInputRef}
              style={[styles.searchInput, { color: colors.text, fontSize: clamp(normalizedFontSize, 14, 22) }]}
              testID="feedback-search-input"
              value={searchQuery}
            />
            {searchQuery ? (
              <Pressable
                accessibilityLabel="Очистить поиск"
                hitSlop={10}
                onPress={() => setSearchQuery('')}
                style={styles.clearSearch}
                testID="feedback-search-clear"
              >
                <X color={colors.textMuted} size={20} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.listHeading}>
          <Text style={[styles.listHeadingText, { color: colors.textMuted, fontSize: clamp(normalizedFontSize + 1, 14, 24) }]}>Лента предложений</Text>
          <Text style={[styles.listCount, { color: colors.textMuted, fontSize: clamp(normalizedFontSize - 1, 12, 20) }]}>Всего: {isOffline ? 0 : filteredFeedbacks.length}</Text>
        </View>

        <FeedbackList
          feedbacks={isOffline ? [] : filteredFeedbacks}
          globalFontSize={normalizedFontSize}
          onDismissKeyboard={dismissSearch}
        />

        <ViewFeedbackModal />
        <CreateFeedbackModal />

        {!isModalOpen && !isOffline ? (
          <Pressable
            accessibilityLabel="Создать предложение"
            accessibilityRole="button"
            onPress={() => {
              dismissSearch()
              openCreateModal()
            }}
            style={[styles.fab, { backgroundColor: colors.brand, shadowColor: colors.brandDeep }]}
            testID="feedback-create-button"
          >
            <Plus color="#FFFFFF" size={38} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </Pressable>
    </ScreenLayout>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appPalette.surface },
  filtersCard: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 17,
    borderWidth: 1,
    borderColor: appPalette.border,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1F2B36',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 3,
  },
  filtersHeading: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12, marginBottom: 10,
  },
  sectionTitle: { flexShrink: 0, color: appPalette.text, fontFamily: 'Roboto-Bold' },
  selectedStatus: {
    flexShrink: 1, color: appPalette.textMuted, fontFamily: 'Roboto-Medium', textAlign: 'right',
  },
  statusList: { gap: 8, paddingBottom: 3 },
  statusChip: {
    minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1,
    borderColor: appPalette.border, borderRadius: 999, backgroundColor: '#FFFFFF',
  },
  statusChipSelected: { borderColor: appPalette.brand, backgroundColor: appPalette.brand },
  statusChipText: { color: appPalette.text, fontFamily: 'Roboto-Medium' },
  statusChipTextSelected: { color: '#FFFFFF' },
  searchBox: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', marginTop: 12,
    paddingHorizontal: 14, borderWidth: 1, borderColor: appPalette.border,
    borderRadius: 18, backgroundColor: '#FFFFFF',
  },
  searchBoxFocused: {
    borderColor: '#3F5F7B',
    boxShadow: '0 0 0 3px rgba(66, 98, 125, 0.12)',
  },
  searchInput: {
    minWidth: 0, flex: 1, paddingHorizontal: 10, paddingVertical: 9,
    color: appPalette.text, fontFamily: 'Roboto-Regular',
  },
  clearSearch: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16,
  },
  listHeading: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, marginBottom: 8, paddingHorizontal: 20,
  },
  listHeadingText: { color: appPalette.textMuted, fontFamily: 'Roboto-Bold' },
  listCount: { color: appPalette.textMuted, fontFamily: 'Roboto-Medium' },
  fab: {
    position: 'absolute', right: 14, bottom: 12, width: 72, height: 72,
    alignItems: 'center', justifyContent: 'center', borderRadius: 36,
    backgroundColor: appPalette.brand, shadowColor: '#920024',
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.32,
    shadowRadius: 17, elevation: 10,
  },
})
