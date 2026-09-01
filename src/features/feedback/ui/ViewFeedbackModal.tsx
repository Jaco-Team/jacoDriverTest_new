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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const ViewFeedbackModal: React.FC = () => {
  const [modal, closeViewModal] = useFeedbackStore(
    useShallow(state => [state.modal, state.closeViewModal]),
  )
  const globalFontSize = useGlobalStore(state => state.globalFontSize)
  const [isImageViewerOpen, setIsImageViewerOpen] = React.useState(false)
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0)
  const feedback = modal.selectedFeedback
  const normalizedFontSize = Number.isFinite(globalFontSize) && globalFontSize > 0
    ? globalFontSize
    : 16
  const bodyFontSize = clamp(normalizedFontSize, 14, 20)
  const sectionFontSize = clamp(bodyFontSize + 1, 15, 24)
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
          <Text style={[styles.title, { fontSize: clamp(bodyFontSize + 6, 20, 30) }]}>
            {String(feedback.title ?? '').trim() || 'Без заголовка'}
          </Text>
          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <View style={styles.dateRow}>
              <Clock color={appPalette.textMuted} size={clamp(bodyFontSize - 1, 13, 18)} />
              <Text style={[styles.date, { fontSize: clamp(bodyFontSize - 1, 13, 18) }]}>
                {formatFeedbackDate(feedback.date_time_create)}
              </Text>
            </View>
            <StatusBadge status={feedback.status} globalFontSize={bodyFontSize - 1} size="details" />
            <TypeBadge type={feedback.type} globalFontSize={bodyFontSize} />
          </View>

          <Text style={[styles.sectionTitle, { fontSize: sectionFontSize }]}>Описание</Text>
          <Text style={[styles.body, { fontSize: bodyFontSize }]}>
            {String(feedback.description ?? '').trim() || 'Нет описания'}
          </Text>

          {images.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { fontSize: sectionFontSize }]}>Изображение</Text>
              <View style={styles.images}>
                {images.map((image, index) => (
                  <Pressable
                    accessibilityLabel="Открыть изображение"
                    key={`${image.uri}-${index}`}
                    onPress={() => { setCurrentImageIndex(index); setIsImageViewerOpen(true) }}
                    style={styles.imageButton}
                  >
                    <Image resizeMode="contain" source={image} style={styles.image} />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={[styles.sectionTitle, styles.answerTitle, { fontSize: sectionFontSize }]}>Ответ</Text>
          <View style={styles.answer}>
            <Text style={[styles.answerText, { fontSize: bodyFontSize }]}>
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
