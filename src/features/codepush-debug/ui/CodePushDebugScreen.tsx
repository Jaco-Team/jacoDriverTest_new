import React, {useState, useSyncExternalStore} from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {SystemBars} from 'react-native-edge-to-edge';
import {ChevronDown, ChevronUp, RefreshCw} from 'lucide-react-native';

import {codePushBuildType, type CodePushDiagnostics} from '@/codePush/diagnostics';
import {codePushDiagnosticsStore} from '@/codePush/diagnosticsStore';
import {normalizeGlobalFontSize, scaleGlobalFontSize} from '@/shared/lib/fontSize';
import {useGlobalStore} from '@/shared/store/store';
import {useAppTheme} from '@/shared/theme/AppThemeProvider';

const sources: Record<CodePushDiagnostics['source'], string> = {
  '': 'Нет сведений', embedded: 'Из установленного приложения',
  current: 'Подтверждённое обновление', previous: 'Резервное обновление',
  trial: 'Пробный запуск обновления', metro: 'Разработка — Metro',
};
const launches: Record<CodePushDiagnostics['launchStatus'], string> = {
  '': 'Нет сведений', running: 'Запущено',
  confirmed: 'Запуск подтверждён', debug: 'Режим разработки', error: 'Нет сведений о запуске',
};
const downloads: Record<CodePushDiagnostics['downloadStatus'], string> = {
  not_checked: 'В этом процессе ещё не проверялось', checking: 'Идёт проверка или загрузка',
  downloaded: 'Пакет скачан', already_downloaded: 'Пакет уже сохранён',
  disabled: 'Обновление отключено', not_selected: 'Не выбрано для этой установки',
  busy: 'Менеджер обновлений занят', error: 'Проверка или загрузка завершилась ошибкой',
};
const candidates: Record<CodePushDiagnostics['candidateStatus'], string> = {
  none: 'Нет сохранённого кандидата', ready: 'Скачано, ещё не обязательно запущено',
  invalid: 'Сохранённый кандидат не прошёл проверку',
};
const storage: Record<CodePushDiagnostics['storageStatus'], string> = {
  ready: 'Доступно', missing: 'Ещё не создано', busy: 'Занято',
  invalid: 'Не удалось проверить сохранённое состояние',
};

function versionLabel(version: string, packageId: string): string {
  return version || (packageId ? 'Версия не определена' : 'Нет сведений');
}

/** A full-screen presentation of the existing immutable, read-only native snapshot. */
export function CodePushDebugScreen({onClose}: {onClose: () => void}): React.JSX.Element {
  const {colors, isDark} = useAppTheme();
  const globalFontSize = useGlobalStore(state => state.globalFontSize);
  const normalized = normalizeGlobalFontSize(globalFontSize);
  const textSize = scaleGlobalFontSize(14, normalized, 12, 24);
  const titleSize = scaleGlobalFontSize(20, normalized, 18, 26);
  const [details, setDetails] = useState(false);
  const state = useSyncExternalStore(codePushDiagnosticsStore.subscribe,
    codePushDiagnosticsStore.getSnapshot, codePushDiagnosticsStore.getSnapshot);
  const result = state.result;
  const loading = state.status === 'loading';

  const summary: Array<[string, string]> = result ? [
    ['Тип сборки', codePushBuildType(result.source)],
    ['Нативная сборка', result.nativeBuild || 'Нет сведений'],
    ['Источник запуска', sources[result.source]],
    ['Выполняемая версия', result.source === 'embedded'
      ? `Встроенная, сборка ${result.nativeBuild || 'не определена'}`
      : result.source === 'metro' ? 'Metro — режим разработки'
      : versionLabel(result.launchedVersion, result.launchedPackageId)],
    ['Подтверждение запуска', result.source === 'embedded' ? 'Встроенный JS, OTA-попытки нет'
      : result.source === 'metro' ? 'Не применяется в Metro'
      : result.source === 'current' ? 'Рабочая версия подтверждена ранее'
      : result.source === 'previous' ? 'Резервная рабочая версия, новой попытки нет'
      : result.source === 'trial' && result.launchStatus === 'running' ? 'Ожидает подтверждения этой попытки'
      : launches[result.launchStatus]],
    ['Подтверждённая версия', versionLabel(result.currentVersion, result.currentPackageId)],
    ['Кандидат', result.candidateStatus === 'none' && result.storageStatus !== 'ready'
      ? 'Нет сведений' : candidates[result.candidateStatus]],
    ...(result.candidateVersion || result.candidatePackageId
      ? [['Версия кандидата', versionLabel(result.candidateVersion, result.candidatePackageId)] as [string, string]] : []),
    ['Проверка и загрузка', result.downloadStatus === 'not_checked' && !result.nativeRuntimeId
      ? 'Нет сведений' : downloads[result.downloadStatus]],
    ...(result.downloadVersion ? [['Версия последней загрузки', result.downloadVersion] as [string, string]] : []),
    ['Последнее событие', result.lastEvent === 'launch_unconfirmed' ? 'Предыдущий запуск не подтверждён'
      : result.lastEvent === 'fatal_after_confirmation' ? 'Откат после фатальной ошибки'
      : result.lastEvent === 'confirmed' ? 'Запуск подтверждён' : 'Нет сведений'],
    ...(result.errorCode ? [['Код диагностики', result.errorCode] as [string, string]] : []),
    ...(result.downloadErrorCode ? [['Код проверки или загрузки', result.downloadErrorCode] as [string, string]] : []),
  ] : [];

  const technical: Array<[string, string]> = result ? [
    ['Приложение', result.applicationIdentifier || 'Нет сведений'],
    ['Runtime', result.nativeRuntimeId || 'Нет сведений'],
    ['Код запуска', result.launchReason || 'Нет сведений'],
    ['Выполняемый пакет', result.launchedPackageId || 'Нет сведений'],
    ['Подтверждённый пакет', result.currentPackageId || 'Нет сведений'],
    ['Резервная версия', versionLabel(result.previousVersion, result.previousPackageId)],
    ['Резервный пакет', result.previousPackageId || 'Нет сведений'],
    ['Пакет кандидата', result.candidatePackageId || 'Нет сведений'],
    ['Пакет последней загрузки', result.downloadPackageId || 'Нет сведений'],
    ['Хеш пакета последнего события', result.lastEventPackageSha256 || 'Нет сведений'],
    ['Хранилище обновлений', storage[result.storageStatus]],
  ] : [];

  function rows(items: Array<[string, string]>): React.ReactNode {
    return items.map(([label, value]) => (
      <View key={label} style={styles.row}>
        <Text style={{color: colors.textMuted, fontSize: textSize, lineHeight: Math.round(textSize * 1.35)}}>{label}</Text>
        <Text selectable style={{color: colors.text, fontSize: textSize, lineHeight: Math.round(textSize * 1.4)}}>{value}</Text>
      </View>
    ));
  }

  return (
    <SafeAreaView accessibilityViewIsModal edges={['top', 'right', 'bottom', 'left']} style={[styles.root, {backgroundColor: colors.surface}]}>
      <SystemBars style={isDark ? 'light' : 'dark'} hidden={false} />
      <View style={[styles.header, {borderBottomColor: colors.border}]}>
        <Text accessibilityRole="header" style={[styles.title, {color: colors.text, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.3)}]}>
          Диагностика
        </Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Закрыть диагностику"
          onPress={onClose} activeOpacity={0.7} style={styles.close}
          testID="codepush-debug-close">
          <Text style={{color: colors.brand, fontSize: textSize, fontWeight: '700'}}>Назад</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="codepush-debug-scroll">
        <View style={[styles.card, {backgroundColor: colors.surfaceRaised, borderColor: colors.border}]}>
          <Text style={{color: colors.textMuted, fontSize: textSize, lineHeight: Math.round(textSize * 1.4)}}>
            Сведения с устройства. «Обновить сведения» только повторяет чтение состояния.
          </Text>
          {loading ? (
            <View style={styles.loading} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.brand} size="small" />
              <Text style={{color: colors.textMuted, fontSize: textSize}}>Читаем сведения…</Text>
            </View>
          ) : null}
          {state.status === 'idle' ? (
            <Text style={[styles.notice, {color: colors.textMuted, fontSize: textSize}]}>Сведения ещё не прочитаны.</Text>
          ) : null}
          {state.status === 'error' ? (
            <Text accessibilityLiveRegion="polite" style={[styles.notice, {color: colors.dangerText, fontSize: textSize, lineHeight: Math.round(textSize * 1.4)}]}>
              {result?.storageStatus === 'busy' || result?.errorCode === 'lock_busy'
                ? 'Хранилище обновлений занято. Можно повторить чтение позже.'
                : 'Не удалось получить все сведения. Доступные данные показаны ниже.'}
            </Text>
          ) : null}
          {rows(summary)}
          {result ? (
            <>
              <TouchableOpacity accessibilityRole="button" accessibilityState={{expanded: details}}
                onPress={() => setDetails(value => !value)}
                activeOpacity={0.7}
                style={[styles.detailsButton, {borderColor: colors.border, backgroundColor: colors.surfaceAlt}]}
                testID="codepush-debug-details">
                <Text style={[styles.buttonText, styles.detailsText, {color: colors.text, fontSize: textSize, lineHeight: Math.round(textSize * 1.4)}]}>
                  {details ? 'Скрыть подробности' : 'Подробности'}
                </Text>
                <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {details ? <ChevronUp size={20} color={colors.textMuted} /> : <ChevronDown size={20} color={colors.textMuted} />}
                </View>
              </TouchableOpacity>
              {details ? rows(technical) : null}
            </>
          ) : null}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Обновить сведения диагностики"
            accessibilityState={{busy: loading, disabled: loading}} disabled={loading}
            onPress={() => { void codePushDiagnosticsStore.refresh(); }}
            activeOpacity={0.7}
            style={[styles.refresh, {backgroundColor: colors.brand}, loading && styles.disabled]}
            testID="codepush-debug-refresh">
            <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <RefreshCw size={20} color="#FFFFFF" />
            </View>
            <Text style={[styles.buttonText, styles.refreshText, {fontSize: textSize, lineHeight: Math.round(textSize * 1.4)}]}>Обновить сведения</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12},
  title: {flex: 1, fontWeight: '700'},
  close: {minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, flexShrink: 0},
  content: {padding: 16, paddingBottom: 24},
  card: {width: '100%', padding: 16, borderWidth: 1, borderRadius: 16},
  row: {marginTop: 12, gap: 3},
  notice: {marginTop: 12},
  loading: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 12},
  detailsButton: {minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, marginTop: 20, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10},
  refresh: {minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, marginTop: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10},
  buttonText: {flexShrink: 1, fontWeight: '700'},
  detailsText: {flex: 1},
  refreshText: {color: '#FFFFFF', textAlign: 'center'},
  disabled: {opacity: 0.55},
});
