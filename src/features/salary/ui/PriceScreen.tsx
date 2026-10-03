import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { appPalette } from '@/shared/styles/appPalette'
import { usePriceScreen } from '../model/usePriceScreen'
import { PriceDatePickerSheet } from './PriceDatePickerSheet'
import { TextDescription } from './TextDescription'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'
import { useScrollToTopOnFocus } from '@/shared/lib/useScrollToTopOnFocus'

export function PriceScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const scrollRef = useScrollToTopOnFocus<ScrollView>()
  const {
    activePicker,
    closePicker,
    globalFontSize,
    hasPriceData,
    isOffline,
    openEndPicker,
    openStartPicker,
    pickerMaxDate,
    pickerMinDate,
    pickerTitle,
    pickerValue,
    selectPickerDate,
    settlementRows,
    showDateEnd,
    showDateStart,
    summaryRows,
    totalPriceFontSize,
    totalPriceLabel,
  } = usePriceScreen()

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]} testID="price-screen">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
        testID="price-scroll"
      >
        <View style={[styles.card, styles.hero, { borderColor: colors.border, backgroundColor: colors.surfaceRaised, shadowColor: colors.shadowStrong }]} testID="price-range-card">
          <Text style={[styles.title, { color: colors.text }]}>
            Расчет
          </Text>

          <View style={[styles.rangeControl, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
            <Pressable
              accessibilityLabel={`Дата от: ${showDateStart}`}
              accessibilityRole="button"
              disabled={isOffline}
              style={styles.rangeButton}
              testID="price-start-date"
              onPress={openStartPicker}
            >
              <Text style={[styles.rangePrefix, { color: colors.textMuted }]}>С</Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.rangeValue,
                  { color: colors.text },
                  {
                    fontSize: globalFontSize,
                    lineHeight: Math.round(globalFontSize * 1.25),
                  },
                ]}
              >
                {showDateStart}
              </Text>
            </Pressable>

            <Text style={[styles.rangeDivider, { color: colors.textMuted }]}>по</Text>

            <Pressable
              accessibilityLabel={`Дата до: ${showDateEnd}`}
              accessibilityRole="button"
              disabled={isOffline}
              style={[styles.rangeButton, styles.rangeButtonEnd]}
              testID="price-end-date"
              onPress={openEndPicker}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.rangeValue,
                  styles.rangeValueEnd,
                  { color: colors.text },
                  {
                    fontSize: globalFontSize,
                    lineHeight: Math.round(globalFontSize * 1.25),
                  },
                ]}
              >
                {showDateEnd}
              </Text>
            </Pressable>
          </View>
        </View>

        {!isOffline && hasPriceData ? <View style={[styles.card, styles.metricsCard, { borderColor: colors.border, backgroundColor: colors.surfaceRaised, shadowColor: colors.shadowStrong }]} testID="price-summary-card">
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[
              styles.total,
              { color: colors.text, fontSize: totalPriceFontSize, lineHeight: totalPriceFontSize },
            ]}
            testID="price-total"
          >
            {totalPriceLabel}
          </Text>

          <View style={styles.metrics}>
            {summaryRows.map((row) => (
              <TextDescription
                key={row.label}
                emphasize={row.emphasize}
                globalFontSize={globalFontSize}
                hideDivider={row.hideDivider}
                text={row.label}
                title={row.description}
                value={row.value}
              />
            ))}
          </View>
        </View> : null}

        {!isOffline && hasPriceData ? <View
          style={[styles.card, styles.metricsCard, { borderColor: colors.border, backgroundColor: colors.surfaceRaised, shadowColor: colors.shadowStrong }]}
          testID="price-settlement-card"
        >
          <View style={styles.metrics}>
            {settlementRows.map((row, index) => (
              <TextDescription
                key={`${row.label}-${index}`}
                emphasize={row.emphasize}
                globalFontSize={globalFontSize}
                hideDivider={row.hideDivider || index === settlementRows.length - 1}
                text={row.label}
                value={row.value}
              />
            ))}
          </View>
        </View> : null}
      </ScrollView>

      <PriceDatePickerSheet
        isOpen={activePicker !== null}
        maxDate={pickerMaxDate}
        minDate={pickerMinDate}
        title={pickerTitle}
        value={pickerValue}
        onClose={closePicker}
        onSelect={selectPickerDate}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appPalette.surface,
  },
  content: {
    width: '100%',
    gap: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(37, 18, 22, 0.08)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#181114',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  hero: {
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  title: {
    marginBottom: 18,
    color: '#1E1216',
    fontFamily: 'Roboto-Bold',
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
  },
  rangeControl: {
    width: '100%',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(66, 98, 125, 0.22)',
    backgroundColor: '#FFFFFF',
  },
  rangeButton: {
    minWidth: 0,
    minHeight: 42,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  rangeButtonEnd: {
    justifyContent: 'flex-end',
    paddingRight: 4,
  },
  rangePrefix: {
    flexShrink: 0,
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Bold',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rangeValue: {
    minWidth: 0,
    flexShrink: 1,
    color: appPalette.primaryDeep,
    fontFamily: 'Roboto-Bold',
  },
  rangeValueEnd: {
    textAlign: 'right',
  },
  rangeDivider: {
    flexShrink: 0,
    paddingHorizontal: 4,
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Bold',
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricsCard: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  total: {
    marginVertical: 20,
    paddingHorizontal: 18,
    color: appPalette.primaryDeep,
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
  },
  metrics: {
    width: '100%',
    paddingHorizontal: 18,
  },
})
