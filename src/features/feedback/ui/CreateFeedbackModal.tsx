import React from 'react'
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native'
import { BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { Check, X } from 'lucide-react-native'
import ImageViewing from 'react-native-image-viewing'

import { appPalette } from '@/shared/styles/appPalette'

import { useCreateFeedbackModal } from '../model/useCreateFeedbackModal'
import { FeedbackSheet } from './FeedbackSheet'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function FeedbackTextInput(props: TextInputProps): React.JSX.Element {
  if (Platform.OS === 'ios') return <BottomSheetTextInput {...props} />
  return <TextInput {...props} />
}

const CreateFeedbackModal: React.FC = () => {
  const {
    isCreateModalOpen,
    closeCreateModal,
    globalFontSize,
    title,
    setTitle,
    description,
    setDescription,
    type,
    setType,
    isNeedNotification,
    setIsNeedNotification,
    isSaving,
    handleSubmit,
    feedbackTypes,
    images,
    showImagePickerOptions,
    removeImage,
  } = useCreateFeedbackModal()
  const [isImageViewerOpen, setIsImageViewerOpen] = React.useState(false)
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0)
  const normalizedFontSize = Number.isFinite(globalFontSize) && globalFontSize > 0
    ? globalFontSize
    : 16
  const bodyFontSize = clamp(normalizedFontSize, 14, 20)
  const sectionFontSize = clamp(bodyFontSize + 1, 15, 24)
  const previewImages = images
    .filter(image => Boolean(image.uri))
    .map(image => ({ uri: image.uri as string }))

  return (
    <FeedbackSheet
      busy={isSaving}
      isOpen={isCreateModalOpen}
      onClose={closeCreateModal}
      testID="feedback-create-sheet"
    >
      <Text style={[styles.title, { fontSize: clamp(bodyFontSize + 6, 20, 30) }]}>Новое предложение</Text>
      <View style={styles.divider} />

      <Text style={[styles.sectionTitle, { fontSize: sectionFontSize }]}>Тип</Text>
      <View style={styles.typeList}>
        {feedbackTypes.map(feedbackType => {
          const selected = type === feedbackType

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              disabled={isSaving}
              key={feedbackType}
              onPress={() => setType(feedbackType)}
              style={[
                styles.typeChip,
                selected && styles.typeChipSelected,
              ]}
              testID={`feedback-type-${feedbackType}`}
            >
              <Text
                style={[
                  styles.typeChipText,
                  selected && styles.typeChipTextSelected,
                  { fontSize: clamp(bodyFontSize - 1, 13, 19) },
                ]}
              >
                {feedbackType}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Text style={[styles.sectionTitle, { fontSize: sectionFontSize }]}>Заголовок</Text>
      <FeedbackTextInput
        editable={!isSaving}
        maxLength={255}
        onChangeText={setTitle}
        placeholder="Введите заголовок"
        placeholderTextColor="#8A94A0"
        style={[styles.input, { fontSize: bodyFontSize }]}
        testID="feedback-title-input"
        value={title}
      />

      <Text style={[styles.sectionTitle, { fontSize: sectionFontSize }]}>Описание</Text>
      <FeedbackTextInput
        editable={!isSaving}
        maxLength={5000}
        multiline
        onChangeText={setDescription}
        placeholder="Расскажите о проблемах в работе приложения, предложите, как можно улучшить систему"
        placeholderTextColor="#8A94A0"
        style={[styles.input, styles.descriptionInput, { fontSize: bodyFontSize }]}
        testID="feedback-description-input"
        textAlignVertical="top"
        value={description}
      />

      <Text style={[styles.sectionTitle, { fontSize: sectionFontSize }]}>Изображение (опционально)</Text>
      {previewImages.length > 0 ? (
        <ScrollView
          horizontal
          contentContainerStyle={styles.imageList}
          showsHorizontalScrollIndicator={false}
        >
          {previewImages.map((image, index) => (
            <View key={`${image.uri}-${index}`} style={styles.imageWrapper}>
              <Pressable onPress={() => { setCurrentImageIndex(index); setIsImageViewerOpen(true) }}>
                <Image source={image} style={styles.image} />
              </Pressable>
              <Pressable
                accessibilityLabel="Удалить изображение"
                disabled={isSaving}
                hitSlop={8}
                onPress={() => removeImage(index)}
                style={styles.removeImage}
              >
                <X color="#FFFFFF" size={15} strokeWidth={3} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={showImagePickerOptions}
        style={styles.imagePicker}
        testID="feedback-image-picker"
      >
        <Text style={[styles.imagePickerText, { fontSize: clamp(bodyFontSize - 1, 13, 18) }]}>
          {images.length > 0 ? 'Добавить еще изображения' : 'Нажмите, чтобы добавить изображения'}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isNeedNotification, disabled: isSaving }}
        disabled={isSaving}
        onPress={() => setIsNeedNotification(!isNeedNotification)}
        style={styles.checkboxRow}
        testID="feedback-notification-checkbox"
      >
        <View style={[styles.checkbox, isNeedNotification && styles.checkboxChecked]}>
          {isNeedNotification ? <Check color="#FFFFFF" size={16} strokeWidth={4} /> : null}
        </View>
        <Text style={[styles.checkboxLabel, { fontSize: bodyFontSize }]}>Уведомить о решении</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={handleSubmit}
        style={[
          styles.submit,
          isSaving && styles.submitDisabled,
        ]}
        testID="feedback-submit-button"
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={[styles.submitText, { fontSize: clamp(bodyFontSize + 2, 15, 24) }]}>Отправить</Text>
        )}
      </Pressable>

      <ImageViewing
        images={previewImages}
        imageIndex={currentImageIndex}
        onRequestClose={() => setIsImageViewerOpen(false)}
        visible={isImageViewerOpen}
      />
    </FeedbackSheet>
  )
}

export default CreateFeedbackModal

const styles = StyleSheet.create({
  title: {
    marginBottom: 16,
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
    lineHeight: 32,
  },
  divider: {
    height: 1,
    marginHorizontal: -20,
    marginBottom: 18,
    backgroundColor: appPalette.border,
  },
  sectionTitle: {
    marginBottom: 8,
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
    lineHeight: 24,
  },
  typeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 17,
  },
  typeChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: appPalette.border,
    borderRadius: 999,
    backgroundColor: appPalette.surface,
  },
  typeChipSelected: { borderColor: appPalette.brand, backgroundColor: appPalette.brand },
  typeChipText: { color: appPalette.text, fontFamily: 'Roboto-Medium' },
  typeChipTextSelected: { color: '#FFFFFF' },
  input: {
    width: '100%',
    minHeight: 54,
    marginBottom: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: appPalette.border,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    color: appPalette.text,
    fontFamily: 'Roboto-Regular',
  },
  descriptionInput: { height: 120, lineHeight: 23 },
  imageList: { gap: 10, paddingBottom: 10 },
  imageWrapper: { position: 'relative' },
  image: { width: 96, height: 96, borderRadius: 12, backgroundColor: appPalette.surfaceAlt },
  removeImage: {
    position: 'absolute', top: 5, right: 5, width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center', borderRadius: 13,
    backgroundColor: appPalette.brand,
  },
  imagePicker: {
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: appPalette.border,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  imagePickerText: { color: appPalette.textMuted, fontFamily: 'Roboto-Regular', textAlign: 'center' },
  checkboxRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    marginBottom: 13,
    paddingRight: 12,
    borderRadius: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#9BAFBE',
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: { borderColor: appPalette.brand, backgroundColor: appPalette.brand },
  checkboxLabel: { color: '#404850', fontFamily: 'Roboto-Regular' },
  submit: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: appPalette.brand,
    shadowColor: '#920024',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#FFFFFF', fontFamily: 'Roboto-Bold' },
})
