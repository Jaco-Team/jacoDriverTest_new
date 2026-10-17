import React from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Clock } from 'lucide-react-native'
import ImageViewing from 'react-native-image-viewing'
import { useShallow } from 'zustand/react/shallow'

import { appPalette } from '@/shared/styles/appPalette'
import { useFeedbackStore, useGlobalStore } from '@/shared/store/store'

import { FeedbackSheet } from './FeedbackSheet'
import { formatFeedbackDate } from './FeedbackItem'
import { StatusBadge } from './StatusBadge'
import { TypeBadge } from './TypeBadge'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'
import { normalizeGlobalFontSize, scaleGlobalFontSize } from '@/shared/lib/fontSize'

const ViewFeedbackModal: React.FC = () => {
  const { colors } = useAppTheme()
  const [modal, closeViewModal] = useFeedbackStore(
    useShallow(state => [state.modal, state.closeViewModal]),
  )
  const globalFontSize = useGlobalStore(state => state.globalFontSize)
  const [isImageViewerOpen, setIsImageViewerOpen] = React.useState(false)
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0)
  const feedback = modal.selectedFeedback
  const normalizedFontSize = normalizeGlobalFontSize(globalFontSize)
  const bodyFontSize = scaleGlobalFontSize(16, normalizedFontSize, 14, 20)
  const sectionFontSize = scaleGlobalFontSize(17, normalizedFontSize, 15, 24)
  const titleFontSize = scaleGlobalFontSize(22, normalizedFontSize, 20)
  const metaFontSize = scaleGlobalFontSize(15, normalizedFontSize, 13, 18)
  const images = (feedback?.images ?? [])
    .filter(image => Boolean(image.uri))
    .map(image => ({ uri: image.uri as string }))

  React.useEffect(() => {
    if (!modal.isViewModalOpen) setIsImageViewerOpen(false)
  }, [modal.isViewModalOpen])

  return (
    <FeedbackSheet
      isOpen={modal.isViewModalOpen && Boolean(feedback)}
      onClose={closeViewModal}
      testID="feedback-view-sheet"
    >
      {feedback ? (
        <>
          <Text style={[styles.title, { color: colors.text, fontSize: titleFontSize }]}>
            {String(feedback.title ?? '').trim() || 'Без заголовка'}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.metaRow}>
            <View style={styles.dateRow}>
              <Clock color={colors.textMuted} size={16} />
              <Text style={[styles.date, { color: colors.textMuted, fontSize: metaFontSize }]}>
                {formatFeedbackDate(feedback.date_time_create)}
              </Text>
            </View>
            <StatusBadge status={feedback.status} globalFontSize={metaFontSize} size="details" />
            <TypeBadge type={feedback.type} globalFontSize={bodyFontSize} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, fontSize: sectionFontSize }]}>Описание</Text>
          <Text style={[styles.body, { color: colors.textMuted, fontSize: bodyFontSize }]}>
            {String(feedback.description ?? '').trim() || 'Нет описания'}
          </Text>

          {images.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text, fontSize: sectionFontSize }]}>Изображение</Text>
              <View style={styles.images}>
                {images.map((image, index) => (
                  <Pressable
                    accessibilityLabel="Открыть изображение"
                    key={`${image.uri}-${index}`}
                    onPress={() => { setCurrentImageIndex(index); setIsImageViewerOpen(true) }}
                    style={[styles.imageButton, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                  >
                    <Image resizeMode="contain" source={image} style={styles.image} />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={[styles.sectionTitle, styles.answerTitle, { color: colors.text, fontSize: sectionFontSize }]}>Ответ</Text>
          <View style={[styles.answer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.answerText, { color: colors.textMuted, fontSize: bodyFontSize }]}>
              {String(feedback.answer ?? '').trim() || 'Нет ответа'}
            </Text>
          </View>

          <ImageViewing
            images={images}
            imageIndex={currentImageIndex}
            onRequestClose={() => setIsImageViewerOpen(false)}
            visible={isImageViewerOpen}
          />
        </>
      ) : null}
    </FeedbackSheet>
  )
}

export default ViewFeedbackModal

const styles = StyleSheet.create({
  title: {
    marginBottom: 16,
    paddingRight: 8,
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
    lineHeight: 32,
  },
  divider: {
    height: 1,
    marginHorizontal: -20,
    marginBottom: 16,
    backgroundColor: appPalette.border,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  dateRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5 },
  date: { color: appPalette.textMuted, fontFamily: 'Roboto-Regular' },
  sectionTitle: {
    marginBottom: 6,
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
    lineHeight: 24,
  },
  body: {
    marginBottom: 16,
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Regular',
    lineHeight: 24,
  },
  images: { gap: 10, marginBottom: 16 },
  imageButton: {
    width: '100%',
    minHeight: 220,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: appPalette.border,
    borderRadius: 16,
    backgroundColor: appPalette.surfaceAlt,
  },
  image: { width: '100%', height: 260 },
  answerTitle: { marginTop: 2 },
  answer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: appPalette.border,
    borderRadius: 16,
    backgroundColor: appPalette.surface,
  },
  answerText: {
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Medium',
    lineHeight: 24,
  },
})
