import React from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import ColorPicker from 'react-native-wheel-color-picker'
import { Check } from 'lucide-react-native'

import {
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
} from '@/components/ui/slider'
import { DelType, ShowType, Theme } from '@/shared/types/globalTypes'
import { ScreenLayout } from '@/shared/ui/ScreenLayout'

import { useSettingsLogic } from '../model/useSettingsLogic'
import { MapPointTheme } from './MapPointTheme'
import { MapPointTime } from './MapPointTime'

const BRAND = '#cc0033'
const TEXT = '#22303d'
const MUTED = '#6f7f8d'
const BORDER = '#dce3e8'
const SURFACE_ALT = '#f3f6f8'
const PRESET_COLORS = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
  '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39',
  '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#607d8b',
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function SettingsCard({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return <View testID={testID} style={styles.card}>{children}</View>
}

function SectionTitle({ children, fontSize, centered = false }: { children: string; fontSize: number; centered?: boolean }) {
  return (
    <Text style={[styles.sectionTitle, centered && styles.textCentered, { fontSize: clamp(fontSize + 2, 16, 28) }]}>
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
    nightMap,
    setNightMap,
    showMapScale,
    setShowMapScale,
    isSaving,
    saveSettings,
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

  return (
    <ScreenLayout>
      <ScrollView
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
          <CheckboxChoice label="Темная тема" selected={nightMap} onPress={() => setNightMap(!nightMap)} fontSize={normalizedFontSize} testID="settings-night-map" />
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

        <View style={[styles.saveButtonSurface, isSaving && styles.saveButtonDisabled]}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={saveSettings}
            style={({ pressed }) => [styles.saveButton, pressed && !isSaving && styles.saveButtonPressed]}
            testID="settings-save"
          >
            <View style={styles.saveButtonContent}>
              <Text style={[styles.saveButtonText, { fontSize: clamp(normalizedFontSize + 1, 15, 24) }]}>
                {isSaving ? 'Сохраняем...' : 'Сохранить'}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenLayout>
  )
}

const cardShadow = Platform.select({
  ios: { shadowColor: '#1f2b36', shadowOpacity: 0.08, shadowRadius: 15, shadowOffset: { width: 0, height: 7 } },
  android: { elevation: 3 },
})

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 30, gap: 18 },
  intro: { borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: '#ffffff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, ...cardShadow },
  introTitle: { color: TEXT, fontWeight: '800', lineHeight: 28 },
  introText: { color: MUTED, lineHeight: 22, marginTop: 8 },
  card: { borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: '#ffffff', padding: 16, overflow: 'visible', ...cardShadow },
  sectionTitle: { color: TEXT, fontWeight: '700', lineHeight: 28, marginBottom: 12 },
  previewSurface: { minHeight: 170, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: '#e5e5e5', paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'space-around', overflow: 'hidden' },
  themePreviewSurface: { minHeight: 400 },
  choiceRow: { minHeight: 43, borderRadius: 12, justifyContent: 'center' },
  choiceRowContent: { width: '100%', minHeight: 43, paddingHorizontal: 4, paddingVertical: 7, flexDirection: 'row', alignItems: 'center' },
  choicePressed: { backgroundColor: '#eef2f5' },
  choiceLabel: { color: TEXT, lineHeight: 24, flex: 1 },
  radioOuter: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: '#9aabb8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioOuterSelected: { borderColor: BRAND },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: BRAND },
  checkbox: { width: 20, height: 20, borderRadius: 3, borderWidth: 2, borderColor: '#9aabb8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxSelected: { borderColor: BRAND, backgroundColor: BRAND },
  helperText: { color: MUTED, lineHeight: 20, marginBottom: 12 },
  textCentered: { textAlign: 'center' },
  scalePreview: { minHeight: 92, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE_ALT, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 14, flexDirection: 'row', alignItems: 'center' },
  scalePreviewItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  sampleText: { color: TEXT, lineHeight: 40 },
  scaleCaption: { color: MUTED, fontSize: 12 },
  sliderTrack: { height: 5, backgroundColor: '#d7dee4' },
  sliderFilledTrack: { backgroundColor: '#42627d' },
  sliderThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#42627d', shadowColor: '#42627d', shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  colorPreview: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 10, marginBottom: 16 },
  colorDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#8c9aa5' },
  colorPreviewText: { color: TEXT, fontWeight: '600' },
  colorPicker: { height: 320, width: '100%' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, paddingTop: 16, paddingHorizontal: 4 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(66,98,125,0.28)' },
  swatchSelected: { borderWidth: 3, borderColor: '#22303d' },
  saveButtonSurface: { minHeight: 54, borderRadius: 16, overflow: 'hidden', backgroundColor: BRAND, marginBottom: 22, shadowColor: '#920024', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  saveButton: { minHeight: 54, borderRadius: 16, backgroundColor: BRAND },
  saveButtonContent: { width: '100%', minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  saveButtonPressed: { backgroundColor: '#a9002a' },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { color: '#ffffff', fontWeight: '700' },
})
