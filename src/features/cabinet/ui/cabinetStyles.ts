import {StyleSheet} from 'react-native'

import {scaleGlobalFontSize} from '@/shared/lib/fontSize'
import type {AppPalette} from '@/shared/styles/appPalette'

export function createCabinetStyles(colors: AppPalette, font: number) {
  const body = scaleGlobalFontSize(16, font)
  const small = scaleGlobalFontSize(15, font)
  const heading = scaleGlobalFontSize(18, font, 12, 28)
  const identity = scaleGlobalFontSize(21, font, 15, 31)

  return StyleSheet.create({
    content: {
      width: '100%',
      maxWidth: 740,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 24,
      gap: 12,
    },
    card: {
      minWidth: 0,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 24,
      backgroundColor: colors.surfaceRaised,
    },
    identity: {flexDirection: 'row', alignItems: 'center', gap: 16},
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: colors.soft,
    },
    photo: {width: '100%', height: '100%'},
    identityText: {flex: 1, minWidth: 0, gap: 3},
    name: {fontSize: identity, fontWeight: '700', color: colors.text},
    titleRow: {minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10},
    titleCopy: {flex: 1, minWidth: 0, gap: 2},
    title: {fontSize: heading, fontWeight: '700', color: colors.text},
    sectionIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {fontSize: body, color: colors.text},
    strong: {fontWeight: '600'},
    muted: {fontSize: small, color: colors.textMuted},
    flexText: {flex: 1, minWidth: 0},
    detailBody: {borderTopWidth: 1, borderColor: colors.border, marginTop: 12, paddingTop: 12},
    fact: {paddingVertical: 8, gap: 3},
    divider: {height: 1, backgroundColor: colors.border},
    groupGap: {gap: 24},
    groupTitle: {fontSize: scaleGlobalFontSize(17, font, 12, 27), fontWeight: '600', color: colors.text},
    groupList: {marginTop: 8},
    examRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      columnGap: 12,
      rowGap: 2,
      paddingVertical: 8,
    },
    examName: {flexGrow: 1, flexShrink: 1, flexBasis: small * 9, minWidth: 0},
    examDate: {marginLeft: 'auto', maxWidth: '100%'},
    nearestDate: {color: colors.text, fontWeight: '700'},
    workRows: {marginTop: 8, gap: 4},
    action: {
      minHeight: 44,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
    },
    materials: {marginTop: 8, gap: 6},
    material: {borderWidth: 1, borderColor: colors.border, backgroundColor: colors.soft},
    promoList: {marginTop: 12, gap: 8},
    promo: {borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, gap: 4, backgroundColor: colors.soft},
    promoHeader: {flexDirection: 'row', alignItems: 'center', gap: 8},
    promoCode: {fontSize: scaleGlobalFontSize(19, font, 13, 29), color: colors.text, fontWeight: '700'},
    copyButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerArea: {
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      columnGap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
    },
    markerLabel: {flexShrink: 1, minWidth: 0},
    settingsAction: {paddingHorizontal: 0, marginTop: 2},
  })
}

export type CabinetStyles = ReturnType<typeof createCabinetStyles>
