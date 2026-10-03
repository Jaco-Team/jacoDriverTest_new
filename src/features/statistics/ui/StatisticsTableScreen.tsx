import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ChartNoAxesCombined, Sigma, UserRound } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PriceDatePickerSheet } from '@/features/salary/ui/PriceDatePickerSheet'
import type { AppPalette } from '@/shared/styles/appPalette'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'
import { useStatisticsTable } from '../model/useStatisticsTable'
import { useScrollToTopOnFocus } from '@/shared/lib/useScrollToTopOnFocus'

interface MetricRowProps {
  label: string
  value: string
  globalFontSize: number
  emphasize?: boolean
  hideDivider?: boolean
}

function MetricRow({
  label,
  value,
  globalFontSize,
  emphasize = false,
  hideDivider = false,
}: MetricRowProps): React.JSX.Element {
  const styles = useStatisticsStyles()
  return (
    <View style={[styles.metricRow, hideDivider && styles.metricRowLast]}>
      <Text
        style={[
          styles.metricLabel,
          {
            fontSize: globalFontSize,
            lineHeight: Math.round(globalFontSize * 1.3),
          },
          emphasize && styles.metricEmphasis,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.metricValue,
          {
            fontSize: globalFontSize,
            lineHeight: Math.round(globalFontSize * 1.3),
          },
          emphasize && styles.metricEmphasis,
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

export function StatisticsTableScreen(): React.JSX.Element {
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const styles = useStatisticsStyles()
  const scrollRef = useScrollToTopOnFocus<ScrollView>()
  const {
    activePicker,
    closePicker,
    dateEndLabel,
    dateStartLabel,
    displayRows,
    getStat,
    globalFontSize,
    isOffline,
    isSummaryRow,
    openPicker,
    pickerMaxDate,
    pickerMinDate,
    pickerTitle,
    pickerValue,
    selectPickerDate,
  } = useStatisticsTable()

  return (
    <View style={styles.screen} testID="statistics-screen">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
        testID="statistics-scroll"
      >
        <View style={[styles.card, styles.hero]} testID="statistics-range-card">
          <Text style={styles.title}>Статистика времени</Text>

          <View style={styles.rangeControl}>
            <Pressable
              accessibilityLabel={`Дата от: ${dateStartLabel}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isOffline }}
              disabled={isOffline}
              style={[
                styles.rangeButton,
                isOffline && { backgroundColor: colors.surfaceAlt, opacity: 0.55 },
              ]}
              testID="statistics-start-date"
              onPress={() => openPicker('start')}
            >
              <Text style={styles.rangePrefix}>С</Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.rangeValue,
                  {
                    fontSize: globalFontSize,
                    lineHeight: Math.round(globalFontSize * 1.25),
                  },
                ]}
              >
                {dateStartLabel}
              </Text>
            </Pressable>

            <Text style={styles.rangeDivider}>по</Text>

            <Pressable
              accessibilityLabel={`Дата до: ${dateEndLabel}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isOffline }}
              disabled={isOffline}
              style={[
                styles.rangeButton,
                styles.rangeButtonEnd,
                isOffline && { backgroundColor: colors.surfaceAlt, opacity: 0.55 },
              ]}
              testID="statistics-end-date"
              onPress={() => openPicker('end')}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.rangeValue,
                  styles.rangeValueEnd,
                  {
                    fontSize: globalFontSize,
                    lineHeight: Math.round(globalFontSize * 1.25),
                  },
                ]}
              >
                {dateEndLabel}
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isOffline }}
            disabled={isOffline}
            style={[
              styles.submit,
              isOffline && styles.submitDisabled,
            ]}
            testID="statistics-submit"
            onPress={getStat}
          >
            <Text
              style={[
                styles.submitText,
                {
                  color: isOffline ? colors.textMuted : '#FFFFFF',
                  fontSize: globalFontSize,
                },
              ]}
            >
              Показать статистику
            </Text>
          </Pressable>
        </View>

        {displayRows.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]} testID="statistics-empty-card">
            <SectionHeader icon="empty" title="Статистика времени" />
            <Text style={[styles.emptyText, { fontSize: globalFontSize }]}>
              За выбранный период данных пока нет.
            </Text>
          </View>
        ) : (
          displayRows.map((row, index) => {
            const summary = isSummaryRow(row)
            const stats = row.other_stat ?? ({} as typeof row.other_stat)
            const rows = [
              {
                label: 'Среднее время (в радиусе)',
                value: row.time2 || '0',
                emphasize: true,
              },
              { label: 'Количество', value: `${stats?.all_count ?? 0}` },
              {
                label: 'Вовремя',
                value: `${stats?.norm ?? 0} (${stats?.norm_percent ?? 0}%)`,
              },
              {
                label: 'С опозданием',
                value: `${stats?.fake ?? 0} (${stats?.fake_percent ?? 0}%)`,
              },
              {
                label: 'Вовремя и в радиусе',
                value: `${stats?.time_dist_true ?? 0} (${stats?.time_dist_true_percent ?? 0}%)`,
              },
              {
                label: 'В радиусе',
                value: `${stats?.true_dist ?? 0} (${stats?.true_dist_percent ?? 0}%)`,
              },
              {
                label: 'Не вовремя и не в радиусе',
                value: `${stats?.time_dist_false ?? 0} (${stats?.time_dist_false_percent ?? 0}%)`,
              },
            ]

            return (
              <View
                key={`${row.name || 'summary'}-${index}`}
                style={[styles.card, styles.statisticsCard]}
                testID={`statistics-courier-card-${index}`}
              >
                <SectionHeader
                  icon={summary ? 'summary' : 'courier'}
                  title={summary ? 'Итого' : row.name || 'Курьер'}
                />
                <View style={styles.metrics}>
                  {rows.map((metric, metricIndex) => (
                    <MetricRow
                      key={metric.label}
                      emphasize={metric.emphasize}
                      globalFontSize={globalFontSize}
                      hideDivider={metricIndex === rows.length - 1}
                      label={metric.label}
                      value={metric.value}
                    />
                  ))}
                </View>
              </View>
            )
          })
        )}
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

function SectionHeader({
  icon,
  title,
}: {
  icon: 'empty' | 'summary' | 'courier'
  title: string
}): React.JSX.Element {
  const { colors } = useAppTheme()
  const styles = useStatisticsStyles()
  const Icon = icon === 'summary' ? Sigma : icon === 'courier' ? UserRound : ChartNoAxesCombined

  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardIcon}>
        <Icon color={colors.primary} size={23} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  )
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    shadowColor: colors.shadowStrong,
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
    color: colors.text,
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
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
    color: colors.textMuted,
    fontFamily: 'Roboto-Bold',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rangeValue: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontFamily: 'Roboto-Bold',
  },
  rangeValueEnd: {
    textAlign: 'right',
  },
  rangeDivider: {
    flexShrink: 0,
    paddingHorizontal: 4,
    color: colors.textMuted,
    fontFamily: 'Roboto-Bold',
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  submit: {
    width: '100%',
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: colors.brand,
    shadowColor: colors.brandDark,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 15,
    elevation: 3,
  },
  submitText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
  },
  submitDisabled: {
    backgroundColor: colors.surfaceAlt,
    shadowOpacity: 0,
    elevation: 0,
  },
  statisticsCard: {
    paddingBottom: 10,
  },
  emptyCard: {
    paddingBottom: 28,
  },
  cardHeader: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  cardIcon: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.soft,
  },
  cardTitle: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontFamily: 'Roboto-Bold',
    fontSize: 23,
    lineHeight: 25,
  },
  metrics: {
    width: '100%',
    paddingHorizontal: 18,
  },
  metricRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metricRowLast: {
    borderBottomWidth: 0,
  },
  metricLabel: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontFamily: 'Roboto-Medium',
  },
  metricValue: {
    maxWidth: '46%',
    flexShrink: 1,
    color: colors.text,
    fontFamily: 'Roboto-Medium',
    textAlign: 'right',
  },
  metricEmphasis: {
    color: colors.text,
    fontFamily: 'Roboto-Bold',
  },
  emptyText: {
    marginHorizontal: 18,
    color: colors.textMuted,
    fontFamily: 'Roboto-Medium',
    lineHeight: 24,
    textAlign: 'center',
  },
  })
}

function useStatisticsStyles() {
  const { colors } = useAppTheme()
  return React.useMemo(() => createStyles(colors), [colors])
}
