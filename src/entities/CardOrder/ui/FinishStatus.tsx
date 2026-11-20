import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Clock3, RefreshCw} from 'lucide-react-native';

import {normalizeGlobalFontSize} from '@/shared/lib/fontSize';
import {useAppTheme} from '@/shared/theme/AppThemeProvider';

interface FinishStatusProps {
  globalFontSize: number;
  acknowledged?: boolean;
}

export function FinishStatus({globalFontSize, acknowledged}: FinishStatusProps) {
  const {colors} = useAppTheme();
  const fontSize = normalizeGlobalFontSize(globalFontSize);
  const Icon = acknowledged ? RefreshCw : Clock3;
  const message = acknowledged
    ? 'Завершение отправлено.\nОбновляем статус.'
    : 'Завершение сохранено.\nОжидает отправки.';

  return (
    <View accessibilityLiveRegion="polite" testID="order-finish-pending" style={[
      styles.block,
      {backgroundColor: colors.surfaceAlt, borderColor: colors.border},
    ]}>
      <View style={styles.row}>
        <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon size={Math.max(18, Math.min(fontSize + 2, 26))}
            color={colors.primary} strokeWidth={1.8} />
        </View>
        <Text style={[styles.message, {fontSize, lineHeight: fontSize + 6, color: colors.text}]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {marginTop: 4, padding: 12, minHeight: 56, borderRadius: 12, borderWidth: 1},
  row: {flexDirection: 'row', alignItems: 'center', gap: 10},
  icon: {flexShrink: 0},
  message: {flex: 1, flexShrink: 1, minWidth: 0, fontFamily: 'Roboto-Regular'},
});
