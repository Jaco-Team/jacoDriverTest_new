import React from 'react'
import { StyleSheet } from 'react-native'

import { appPalettes, type AppPalette } from '@/shared/styles/appPalette'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'

function createGraphStyles(colors: AppPalette) {
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
    gap: 18,
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: 'Roboto-Bold',
    fontSize: 13,
    letterSpacing: 1.6,
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  monthButton: {
    width: '100%',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  monthButtonText: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
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
  tableShell: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  tableFrame: {
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  lastColumn: {
    borderRightWidth: 0,
  },
  lastRowCell: {
    borderBottomWidth: 0,
  },
  headCell: {
    backgroundColor: colors.soft,
  },
  headText: {
    color: colors.textMuted,
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
  },
  bodyText: {
    color: colors.text,
    fontFamily: 'Roboto-Medium',
    textAlign: 'center',
  },
  weekendCell: {
    backgroundColor: colors.surfaceAlt,
  },
  weekendText: {
    color: colors.brand,
  },
  todayCell: {
    backgroundColor: colors.softStrong,
    borderBottomColor: colors.primary,
    borderBottomWidth: 3,
  },
  currentUserCell: {
    backgroundColor: colors.soft,
  },
  currentUserNameCell: {
    backgroundColor: colors.softStrong,
    borderLeftWidth: 5,
    borderLeftColor: colors.primary,
  },
  currentUserText: {
    color: colors.text,
    fontFamily: 'Roboto-Bold',
  },
  currentTodayCell: {
    backgroundColor: 'rgba(66, 98, 125, 0.22)',
  },
  filledHoursCell: {
    backgroundColor: colors.soft,
  },
  empty: {
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceAlt,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: 'Roboto-Medium',
    lineHeight: 22,
    textAlign: 'center',
  },
  })
}

export const graphStyles = createGraphStyles(appPalettes.light)

export function useGraphStyles() {
  const { colors } = useAppTheme()
  return React.useMemo(() => createGraphStyles(colors), [colors])
}
