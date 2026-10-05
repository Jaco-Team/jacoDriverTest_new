import React from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation, type ParamListBase } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import ColorPicker from 'react-native-wheel-color-picker'
import { Check } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet'

import {
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
} from '@/components/ui/slider'
import { DelType, ShowType, Theme } from '@/shared/types/globalTypes'
import { ScreenLayout } from '@/shared/ui/ScreenLayout'
import { useScrollToTopOnFocus } from '@/shared/lib/useScrollToTopOnFocus'
import {
  useAppTheme,
  type AppThemePreference,
} from '@/shared/theme/AppThemeProvider'
import type { AppPalette } from '@/shared/styles/appPalette'
import { useIsOffline } from '@/shared/ui/ConnectivityLocationIndicator'

import { useSettingsLogic } from '../model/useSettingsLogic'
import { MapPointTheme } from './MapPointTheme'
import { MapPointTime } from './MapPointTime'
import { OfflineCityMapsSettings } from '@/features/offline-map/ui/OfflineCityMapsSettings'

const PRESET_COLORS = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
  '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39',
  '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#607d8b',
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function SettingsCard({
  children,
  roomy = false,
  testID,
}: {
  children: React.ReactNode
  roomy?: boolean
  testID?: string
}) {
  const styles = useSettingsStyles()
  return <View testID={testID} style={[styles.card, roomy && styles.cardRoomy]}>{children}</View>
}

function SectionTitle({ children, fontSize, centered = false }: { children: string; fontSize: number; centered?: boolean }) {
  const styles = useSettingsStyles()
  const titleFontSize = clamp(fontSize + 2, 16, 28)

  return (
    <Text
      style={[
        styles.sectionTitle,
        centered && styles.textCentered,
        { fontSize: titleFontSize, lineHeight: titleFontSize * 1.2 },
      ]}
    >
      {children}
    </Text>
  )
}

type ChoiceProps = {
  label: string
  selected: boolean
  onPress: () => void
  fontSize: number
  testID?: string
}

function RadioChoice({ label, selected, onPress, fontSize, testID }: ChoiceProps) {
  const styles = useSettingsStyles()
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choiceRow, pressed && styles.choicePressed]}
      testID={testID}
    >
      <View style={styles.choiceRowContent}>
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
        <Text style={[styles.choiceLabel, { fontSize: clamp(fontSize, 14, 22) }]}>{label}</Text>
      </View>
    </Pressable>
  )
}

function CheckboxChoice({ label, selected, onPress, fontSize, testID }: ChoiceProps) {
  const styles = useSettingsStyles()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choiceRow, pressed && styles.choicePressed]}
      testID={testID}
    >
      <View style={styles.choiceRowContent}>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected ? <Check color="#ffffff" size={15} strokeWidth={4} /> : null}
        </View>
        <Text style={[styles.choiceLabel, { fontSize: clamp(fontSize, 14, 22) }]}>{label}</Text>
      </View>
    </Pressable>
  )
}

type SettingsSliderProps = {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  testID: string
}

function SettingsSlider({ value, min, max, step, onChange, testID }: SettingsSliderProps) {
  const styles = useSettingsStyles()
  return (
    <Slider
      value={value}
      minValue={min}
      maxValue={max}
      step={step}
      onChange={onChange}
      orientation="horizontal"
      size="lg"
      testID={testID}
    >
      <SliderTrack style={styles.sliderTrack}>
        <SliderFilledTrack style={styles.sliderFilledTrack} />
      </SliderTrack>
      <SliderThumb style={styles.sliderThumb} />
    </Slider>
  )
}

export function SettingsScreen(): React.JSX.Element {
  const isOffline = useIsOffline()
  const { colors } = useAppTheme()
  const styles = useSettingsStyles()
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
  const insets = useSafeAreaInsets()
  const [isPointListOpen, setIsPointListOpen] = React.useState(false)
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = React.useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false)
  const {
    globalFontSize,
    typeShowDel,
    setTypeShowDel,
    centeredMap,
    setCenteredMap,
    fontSize,
    setFontSize,
    updateInterval,
    setUpdateInterval,
    color,
    setColor,
    isColorPickerActive,
    setIsColorPickerActive,
    mapDataType,
    setMapDataType,
    markerTheme,
    setMarkerTheme,
    mapScale,
    setMapScale,
    appThemePreference,
    setAppThemePreference,
    showMapScale,
    setShowMapScale,
    isSaving,
    saveSettings,
    points = [],
    pointId = null,
    setPointId,
    isDemoAccount,
    deleteDemoAccount,
  } = useSettingsLogic()

  const normalizedFontSize = Number.isFinite(globalFontSize) && globalFontSize > 0
    ? globalFontSize
    : 16
  const helperFontSize = clamp(normalizedFontSize - 1, 12, 20)
  const timeOptions: Array<{ value: ShowType; text: string }> = [
    { value: 'norm', text: '21:46 (53 мин.)' },
    { value: 'full', text: '21:46 - 22:16 (53 мин.)' },
    { value: 'min', text: '53 мин.' },
  ]
  const themeOptions: Array<{ value: Theme; text: string }> = [
    { value: 'classic', text: 'Классический яндекс' },
    { value: 'transparent', text: '21:46 (53 мин.)' },
    { value: 'transparent_white', text: '21:46 (53 мин.)' },
    { value: 'white', text: '21:46 (53 мин.)' },
    { value: 'white_border', text: '21:46 (53 мин.)' },
    { value: 'black', text: '21:46 (53 мин.)' },
  ]
  const appThemeOptions: Array<{ value: AppThemePreference; text: string }> = [
    { value: 'system', text: 'Системная' },
    { value: 'light', text: 'Светлая' },
    { value: 'dark', text: 'Тёмная' },
  ]
  const pointOptions = [...points]
    .filter(point => Number(point.id) > 0)
    .sort((left, right) => {
      const cityDiff = Number(left.city_id ?? 0) - Number(right.city_id ?? 0)
      return cityDiff !== 0 ? cityDiff : Number(left.id) - Number(right.id)
    })
  const selectedPoint = pointOptions.find(point => point.id === pointId) ?? null
  const scrollRef = useScrollToTopOnFocus<ScrollView>()

  const closePointList = () => setIsPointListOpen(false)
  const closeDeleteSheet = () => {
    if (!isDeletingAccount) {
      setIsDeleteSheetOpen(false)
    }
  }

  const confirmDemoAccountDeletion = async () => {
    if (isDeletingAccount) {
      return
    }

    setIsDeletingAccount(true)

    try {
      const deleted = await deleteDemoAccount()

      if (deleted) {
        setIsDeleteSheetOpen(false)
        navigation.reset({ index: 0, routes: [{ name: 'Auth' }] })
      }
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <>
      <ScreenLayout>
        <ScrollView
          ref={scrollRef}
          scrollEnabled={!isColorPickerActive}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
        <View style={styles.intro}>
          <Text style={[styles.introTitle, { fontSize: clamp(normalizedFontSize + 4, 18, 32) }]}>
            Настройки приложения
          </Text>
          <Text style={[styles.introText, { fontSize: clamp(normalizedFontSize, 14, 24) }]}>
            Настройте отображение карты и интерфейса под свой рабочий ритм.
          </Text>
        </View>

        {pointOptions.length > 0 ? (
          <SettingsCard roomy testID="settings-cafe-card">
            <SectionTitle fontSize={normalizedFontSize}>Кафе</SectionTitle>
            <View style={styles.pointSelect} testID="settings-cafe-field">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isPointListOpen }}
                onPress={() => setIsPointListOpen(true)}
                style={styles.pointSelectValue}
                testID="settings-cafe-select"
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.pointSelectText,
                    !selectedPoint && styles.pointSelectPlaceholder,
                    {
                      fontSize: selectedPoint
                        ? clamp(normalizedFontSize, 14, 22)
                        : clamp(normalizedFontSize - 1, 12, 20),
                    },
                  ]}
                >
                  {selectedPoint?.name ?? 'Выберите кафе'}
                </Text>
              </Pressable>

              <View style={styles.pointSelectControls}>
                <Pressable
                  accessibilityLabel="Открыть список кафе"
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={() => setIsPointListOpen(true)}
                  style={styles.pointSelectControl}
                  testID="settings-cafe-open"
                >
                  <View style={styles.pointSelectArrow} />
                </Pressable>
              </View>
            </View>
          </SettingsCard>
        ) : null}

        <SettingsCard testID="settings-app-theme-card">
          <SectionTitle fontSize={normalizedFontSize}>Тема приложения</SectionTitle>
          {appThemeOptions.map(option => (
            <RadioChoice
              key={option.value}
              label={option.text}
              selected={appThemePreference === option.value}
              onPress={() => setAppThemePreference(option.value)}
              fontSize={normalizedFontSize}
              testID={`settings-app-theme-${option.value}`}
            />
          ))}
          <Text style={[styles.helperText, { fontSize: helperFontSize, marginTop: 6, marginBottom: 0 }]}>
            Тема карты меняется вместе с темой приложения.
          </Text>
        </SettingsCard>

        <SettingsCard testID="settings-offline-maps-card">
          <OfflineCityMapsSettings fontSize={normalizedFontSize} />
        </SettingsCard>

        <SettingsCard testID="settings-map-data-card">
          <SectionTitle fontSize={normalizedFontSize}>Формат данных на карте</SectionTitle>
          <View style={styles.previewSurface}>
            {timeOptions.map(option => (
              <MapPointTime
                key={option.value}
                value={option.value}
                isActive={mapDataType === option.value}
                setActive={setMapDataType}
                theme="white_border"
                text={option.text}
              />
            ))}
          </View>
        </SettingsCard>

        <SettingsCard testID="settings-marker-theme-card">
          <SectionTitle fontSize={normalizedFontSize}>Оформление</SectionTitle>
          <View style={[styles.previewSurface, styles.themePreviewSurface]}>
            {themeOptions.map(option => (
              <MapPointTheme
                key={option.value}
                value={option.value}
                isActive={markerTheme === option.value}
                setActive={setMarkerTheme}
                theme={option.value}
                text={option.text}
              />
            ))}
          </View>
        </SettingsCard>

        <SettingsCard testID="settings-cancelled-orders-card">
          <SectionTitle fontSize={normalizedFontSize}>Отмененные заказы</SectionTitle>
          {([
            ['full', 'Показывать весь день'],
            ['min', '30 минут'],
            ['max', '2 часа'],
          ] as Array<[DelType, string]>).map(([value, label]) => (
            <RadioChoice
              key={value}
              label={label}
              selected={typeShowDel === value}
              onPress={() => setTypeShowDel(value)}
              fontSize={normalizedFontSize}
              testID={`settings-cancelled-${value}`}
            />
          ))}
        </SettingsCard>

        <SettingsCard testID="settings-map-card">
          <SectionTitle fontSize={normalizedFontSize}>Карта</SectionTitle>
          <CheckboxChoice label="Ползунок масштабирования карты" selected={showMapScale} onPress={() => setShowMapScale(!showMapScale)} fontSize={normalizedFontSize} testID="settings-map-scale-control" />
          <CheckboxChoice label="При взятии, отмене заказа, центрировать карту" selected={centeredMap} onPress={() => setCenteredMap(!centeredMap)} fontSize={normalizedFontSize} testID="settings-center-map" />
        </SettingsCard>

        <SettingsCard testID="settings-font-size-card">
          <SectionTitle fontSize={normalizedFontSize}>Размер шрифта</SectionTitle>
          <Text style={[styles.helperText, { fontSize: helperFontSize }]}>Текущее значение: {fontSize}</Text>
          <View style={styles.scalePreview}>
            <View style={styles.scalePreviewItem}><Text style={[styles.sampleText, { fontSize: 10 }]}>Ая</Text><Text style={styles.scaleCaption}>Меньше</Text></View>
            <View style={styles.scalePreviewItem}><Text style={[styles.sampleText, { fontSize: clamp(fontSize, 14, 24) }]}>Ая</Text><Text style={styles.scaleCaption}>Текущий</Text></View>
            <View style={styles.scalePreviewItem}><Text style={[styles.sampleText, { fontSize: 40 }]}>Ая</Text><Text style={styles.scaleCaption}>Больше</Text></View>
          </View>
          <SettingsSlider value={fontSize} min={10} max={40} step={1} onChange={value => setFontSize(Math.round(value))} testID="settings-font-size-slider" />
        </SettingsCard>

        <SettingsCard testID="settings-map-scale-card">
          <SectionTitle fontSize={normalizedFontSize}>Масштабирование иконок на карте</SectionTitle>
          <Text style={[styles.helperText, { fontSize: helperFontSize }]}>Текущее значение: {mapScale.toFixed(1)}</Text>
          <SettingsSlider value={mapScale} min={0.5} max={1.3} step={0.1} onChange={value => setMapScale(Number(value.toFixed(1)))} testID="settings-map-scale-slider" />
        </SettingsCard>

        <SettingsCard testID="settings-update-interval-card">
          <SectionTitle fontSize={normalizedFontSize}>Частота обновления заказов</SectionTitle>
          {([
            [0, 'Не обновлять'],
            [10, 'Каждые 10 секунд'],
            [30, 'Каждые 30 секунд'],
            [60, 'Каждые 60 секунд'],
            [120, 'Каждые 120 секунд'],
          ] as Array<[number, string]>).map(([value, label]) => (
            <RadioChoice key={value} label={label} selected={updateInterval === value} onPress={() => setUpdateInterval(value)} fontSize={normalizedFontSize} testID={`settings-update-${value}`} />
          ))}
        </SettingsCard>

        <SettingsCard testID="settings-color-card">
          <SectionTitle centered fontSize={normalizedFontSize}>Цвет на карте</SectionTitle>
          <Text style={[styles.helperText, styles.textCentered, { fontSize: helperFontSize }]}>Текущий цвет: {color.toUpperCase()}</Text>
          <View style={styles.colorPreview}>
            <View style={[styles.colorDot, { backgroundColor: color }]} />
            <Text style={[styles.colorPreviewText, { fontSize: normalizedFontSize }]}>Выбранный оттенок</Text>
          </View>
          <View style={styles.colorPicker} testID="settings-color-picker">
            <ColorPicker
              color={color}
              onColorChangeComplete={nextColor => { setColor(nextColor); setIsColorPickerActive(false) }}
              thumbSize={34}
              sliderSize={30}
              noSnap
              row={false}
              swatches={false}
              onInteractionStart={() => setIsColorPickerActive(true)}
            />
          </View>
          <View style={styles.palette} testID="settings-color-palette">
            {PRESET_COLORS.map(preset => {
              const selected = color.slice(0, 7).toLowerCase() === preset.toLowerCase()
              return (
                <Pressable
                  accessibilityLabel={preset}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={preset}
                  onPress={() => setColor(preset)}
                  style={[styles.swatch, { backgroundColor: preset }, selected && styles.swatchSelected]}
                />
              )
            })}
          </View>
        </SettingsCard>

        <View
          style={[
            styles.saveButtonSurface,
            isSaving && styles.saveButtonBusy,
            isOffline && styles.saveButtonOffline,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: isSaving, disabled: isSaving || isOffline }}
            disabled={isSaving || isOffline}
            onPress={saveSettings}
            style={({ pressed }) => [
              styles.saveButton,
              isOffline && styles.saveButtonControlOffline,
              pressed && !isSaving && !isOffline && styles.saveButtonPressed,
            ]}
            testID="settings-save"
          >
            <View style={styles.saveButtonContent}>
              <Text
                style={[
                  styles.saveButtonText,
                  {
                    color: isOffline ? colors.textMuted : '#ffffff',
                    fontSize: clamp(normalizedFontSize + 1, 15, 24),
                  },
                ]}
              >
                {isSaving ? 'Сохраняем...' : 'Сохранить'}
              </Text>
            </View>
          </Pressable>
        </View>

        {isDemoAccount ? (
          <View style={styles.dangerZone} testID="settings-delete-account-zone">
            <Text style={[styles.dangerTitle, { fontSize: clamp(normalizedFontSize + 2, 16, 24) }]}>
              Удаление аккаунта
            </Text>
            <Text style={[styles.dangerText, { fontSize: helperFontSize }]}>
              После удаления вы выйдете из аккаунта. Это действие нельзя отменить.
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setIsDeleteSheetOpen(true)}
              style={({ pressed }) => [styles.deleteAccountButton, pressed && styles.deleteAccountButtonPressed]}
              testID="settings-delete-account"
            >
              <Text style={[styles.deleteAccountButtonText, { fontSize: clamp(normalizedFontSize, 14, 22) }]}>
                Удалить аккаунт
              </Text>
            </Pressable>
          </View>
        ) : null}
        </ScrollView>
      </ScreenLayout>

      <Actionsheet isOpen={isPointListOpen} onClose={closePointList}>
        <ActionsheetBackdrop testID="settings-cafe-backdrop" />
        <ActionsheetContent
          style={[styles.pointSheet, { paddingBottom: insets.bottom + 24 }]}
          testID="settings-cafe-sheet"
        >
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator style={styles.pointSheetHandleArea}>
              <View style={styles.pointSheetHandle} />
            </ActionsheetDragIndicator>
          </ActionsheetDragIndicatorWrapper>

          <Text
            style={[
              styles.pointSheetTitle,
              { fontSize: clamp(normalizedFontSize + 8, 22, 30) },
            ]}
          >
            Выберите кафе
          </Text>

          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            style={styles.pointOptionsScroll}
            contentContainerStyle={styles.pointOptionsContent}
          >
            {pointOptions.map(point => {
              const selected = point.id === pointId

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={point.id}
                  onPress={() => {
                    setPointId(point.id)
                    closePointList()
                  }}
                  style={[
                    styles.pointOption,
                    selected && styles.pointOptionSelected,
                  ]}
                  testID={`settings-cafe-${point.id}`}
                >
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.pointOptionText,
                      { fontSize: clamp(normalizedFontSize + 2, 16, 22) },
                      selected && styles.pointOptionTextSelected,
                    ]}
                  >
                    {point.name}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </ActionsheetContent>
      </Actionsheet>

      <Actionsheet isOpen={isDeleteSheetOpen} onClose={closeDeleteSheet}>
        <ActionsheetBackdrop testID="settings-delete-account-backdrop" />
        <ActionsheetContent
          style={[styles.deleteSheet, { paddingBottom: insets.bottom + 24 }]}
          testID="settings-delete-account-sheet"
        >
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator style={styles.pointSheetHandleArea}>
              <View style={styles.pointSheetHandle} />
            </ActionsheetDragIndicator>
          </ActionsheetDragIndicatorWrapper>

          <Text style={[styles.deleteSheetTitle, { fontSize: clamp(normalizedFontSize + 6, 20, 28) }]}>
            Удалить аккаунт?
          </Text>
          <Text style={[styles.deleteSheetText, { fontSize: clamp(normalizedFontSize, 14, 21) }]}>
            Вы уверены? После удаления вы выйдете из аккаунта, а локальная сессия будет очищена.
          </Text>

          <View style={styles.deleteSheetActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isDeletingAccount}
              onPress={closeDeleteSheet}
              style={styles.deleteSheetCancel}
              testID="settings-delete-account-cancel"
            >
              <Text style={styles.deleteSheetCancelText}>Отмена</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: isDeletingAccount, disabled: isDeletingAccount }}
              disabled={isDeletingAccount}
              onPress={() => void confirmDemoAccountDeletion()}
              style={[styles.deleteSheetConfirm, isDeletingAccount && styles.deleteSheetConfirmDisabled]}
              testID="settings-delete-account-confirm"
            >
              {isDeletingAccount ? (
                <ActivityIndicator color="#ffffff" size="small" testID="settings-delete-account-loading" />
              ) : (
                <Text style={styles.deleteSheetConfirmText}>Удалить</Text>
              )}
            </Pressable>
          </View>
        </ActionsheetContent>
      </Actionsheet>
    </>
  )
}

function createStyles(colors: AppPalette) {
  const cardShadow = Platform.select({
    ios: { shadowColor: colors.shadowStrong, shadowOpacity: 0.16, shadowRadius: 15, shadowOffset: { width: 0, height: 7 } },
    android: { elevation: 3 },
  })

  return StyleSheet.create({
  content: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 30, gap: 18 },
  intro: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, ...cardShadow },
  introTitle: { color: colors.text, fontWeight: '800', lineHeight: 28 },
  introText: { color: colors.textMuted, lineHeight: 22, marginTop: 8 },
  card: { borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, padding: 16, overflow: 'visible', ...cardShadow },
  cardRoomy: { padding: 20 },
  sectionTitle: { color: colors.text, fontWeight: '700', marginBottom: 12 },
  previewSurface: { minHeight: 170, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'space-around', overflow: 'hidden' },
  themePreviewSurface: { minHeight: 400 },
  choiceRow: { minHeight: 43, borderRadius: 12, justifyContent: 'center' },
  choiceRowContent: { width: '100%', minHeight: 43, paddingHorizontal: 4, paddingVertical: 7, flexDirection: 'row', alignItems: 'center' },
  choicePressed: { backgroundColor: colors.surfacePressed },
  choiceLabel: { color: colors.text, lineHeight: 24, flex: 1 },
  pointSelect: { width: '100%', minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, shadowColor: colors.shadowStrong, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 1 },
  pointSelectValue: { flex: 1, minHeight: 56, justifyContent: 'center' },
  pointSelectText: { color: colors.text, fontWeight: '600', lineHeight: 22 },
  pointSelectPlaceholder: { color: colors.textMuted },
  pointSelectControls: { flexDirection: 'row', alignItems: 'center' },
  pointSelectControl: { width: 34, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  pointSelectArrow: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.textMuted },
  pointSheet: { minHeight: '68%', maxHeight: '90%', overflow: 'hidden', paddingTop: 8, paddingHorizontal: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 0, backgroundColor: colors.surfaceRaised },
  pointSheetHandleArea: { width: '100%', height: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  pointSheetHandle: { width: 56, height: 5, borderRadius: 999, backgroundColor: colors.border },
  pointSheetTitle: { width: '100%', color: colors.text, fontWeight: '800', lineHeight: 36, textAlign: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 18 },
  pointOptionsScroll: { width: '100%', flexGrow: 0 },
  pointOptionsContent: { paddingHorizontal: 32, paddingBottom: 24 },
  pointOption: { width: '100%', minHeight: 62, paddingHorizontal: 15, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.surfaceRaised },
  pointOptionSelected: { borderLeftWidth: 3, borderLeftColor: colors.brand, backgroundColor: colors.brandSoft },
  pointOptionText: { flex: 1, color: colors.text, fontWeight: '400', lineHeight: 24 },
  pointOptionTextSelected: { fontWeight: '700' },
  radioOuter: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioOuterSelected: { borderColor: colors.brand },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.brand },
  checkbox: { width: 20, height: 20, borderRadius: 3, borderWidth: 2, borderColor: '#9aabb8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  helperText: { color: colors.textMuted, lineHeight: 20, marginBottom: 12 },
  textCentered: { textAlign: 'center' },
  scalePreview: { minHeight: 92, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 14, flexDirection: 'row', alignItems: 'center' },
  scalePreviewItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  sampleText: { color: colors.text, lineHeight: 40 },
  scaleCaption: { color: colors.textMuted, fontSize: 12 },
  sliderTrack: { height: 5, backgroundColor: colors.border },
  sliderFilledTrack: { backgroundColor: colors.primary },
  sliderThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  colorPreview: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 10, marginBottom: 16 },
  colorDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.textMuted },
  colorPreviewText: { color: colors.text, fontWeight: '600' },
  colorPicker: { height: 320, width: '100%' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, paddingTop: 16, paddingHorizontal: 4 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(66,98,125,0.28)' },
  swatchSelected: { borderWidth: 3, borderColor: colors.text },
  saveButtonSurface: { minHeight: 54, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.brand, marginBottom: 22, shadowColor: colors.brandDeep, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  saveButton: { minHeight: 54, borderRadius: 16, backgroundColor: colors.brand },
  saveButtonContent: { width: '100%', minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  saveButtonPressed: { backgroundColor: colors.brandDark },
  saveButtonBusy: { opacity: 0.65 },
  saveButtonOffline: { backgroundColor: colors.surfaceAlt, shadowOpacity: 0, elevation: 0 },
  saveButtonControlOffline: { backgroundColor: colors.surfaceAlt },
  saveButtonText: { color: '#ffffff', fontWeight: '700' },
  dangerZone: { borderRadius: 20, borderWidth: 1, borderColor: colors.brandSoftStrong, backgroundColor: colors.dangerSurface, padding: 16, marginBottom: 22 },
  dangerTitle: { color: colors.dangerText, fontWeight: '800', lineHeight: 28 },
  dangerText: { color: colors.textMuted, lineHeight: 21, marginTop: 7, marginBottom: 16 },
  deleteAccountButton: { alignSelf: 'flex-start', minHeight: 24, justifyContent: 'center' },
  deleteAccountButtonPressed: { opacity: 0.7 },
  deleteAccountButtonText: { color: colors.brand, fontWeight: '700' },
  deleteSheet: { paddingTop: 8, paddingHorizontal: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 0, backgroundColor: colors.surfaceRaised },
  deleteSheetTitle: { width: '100%', color: colors.text, fontWeight: '800', lineHeight: 34, textAlign: 'left', paddingTop: 14 },
  deleteSheetText: { width: '100%', color: colors.textMuted, lineHeight: 23, marginTop: 8 },
  deleteSheetActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 24 },
  deleteSheetCancel: { flex: 1, minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  deleteSheetCancelText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  deleteSheetConfirm: { flex: 1, minHeight: 52, borderRadius: 15, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  deleteSheetConfirmDisabled: { opacity: 0.65 },
  deleteSheetConfirmText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  })
}

function useSettingsStyles() {
  const { colors } = useAppTheme()
  return React.useMemo(() => createStyles(colors), [colors])
}
