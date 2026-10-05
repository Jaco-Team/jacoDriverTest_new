import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Check,
  Download,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import {useAppTheme} from '@/shared/theme/AppThemeProvider';
import {useIsOffline} from '@/shared/lib/connectivityContext';
import {useOrdersStore, useSettingsStore} from '@/shared/store/store';
import {useOfflineMapStore} from '../model/offlineMap.store';
import {
  OFFLINE_MAP_CITIES,
  findOfflineMapCity,
  getOfflineMapCity,
} from '../model/offlineMapCities';

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toLocaleString('ru-RU', {maximumFractionDigits: 1})} МБ`;
}

export function OfflineCityMapsSettings({fontSize}: {fontSize: number}) {
  const state = useOfflineMapStore();
  const {hydrated, selectedCityId, selectCity} = state;
  const isOffline = useIsOffline();
  const {colors} = useAppTheme();
  const insets = useSafeAreaInsets();
  const home = useOrdersStore(store => store.home);
  const pointName = useSettingsStore(
    store => store.points.find(point => point.id === store.point_id)?.name,
  );
  const [deleteCityId, setDeleteCityId] = useState<string | null>(null);
  const textSize = Math.min(22, Math.max(14, fontSize));
  const metaSize = Math.min(20, Math.max(12, textSize - 1));
  const city = getOfflineMapCity(state.selectedCityId);
  const entry = city ? state.cities[city.id] : undefined;
  const downloading = entry?.status === 'downloading';
  const preparing = downloading && !entry.regionId;
  const ready = entry?.status === 'ready';
  const paused = entry?.status === 'paused' || entry?.status === 'error';
  const progress = Math.floor((entry?.progress ?? 0) * 100);
  const deleting = !!state.deletingCityId;
  const blocked =
    !state.hydrated || !city || isOffline || deleting || !!state.busyCityId;
  const deleteCity = deleteCityId ? getOfflineMapCity(deleteCityId) : undefined;
  const error = entry?.error || state.error;

  useEffect(() => {
    if (!hydrated || selectedCityId) return;
    const preferred =
      OFFLINE_MAP_CITIES.find(
        item => pointName?.split(',')[0].trim() === item.name,
      ) ?? (home ? findOfflineMapCity(home) : undefined);
    if (preferred) selectCity(preferred.id);
  }, [hydrated, selectedCityId, selectCity, pointName, home]);

  const button = (
    label: string,
    onPress: () => void,
    disabled: boolean,
    primary: boolean,
    icon: React.ReactNode,
    testID: string,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[
        styles.button,
        {
          backgroundColor: primary ? colors.brand : colors.surfaceAlt,
          borderColor: colors.border,
        },
        disabled && styles.disabled,
      ]}>
      {icon}
      <Text
        style={{
          fontSize: textSize,
          fontWeight: '700',
          color: primary ? '#ffffff' : colors.text,
        }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <>
      <View style={styles.content} testID="settings-offline-maps">
        <Text
          style={{
            fontSize: textSize + 2,
            fontWeight: '700',
            color: colors.text,
          }}>
          Офлайн-карты
        </Text>
        <Text style={{fontSize: metaSize, color: colors.textMuted}}>Город</Text>
        <View style={styles.cities} accessibilityRole="radiogroup">
          {OFFLINE_MAP_CITIES.map(item => (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityLabel={item.name}
              accessibilityState={{
                selected: state.selectedCityId === item.id,
                disabled: !state.hydrated || deleting,
              }}
              disabled={!state.hydrated || deleting}
              onPress={() => state.selectCity(item.id)}
              testID={`offline-city-${item.id}`}
              style={[
                styles.city,
                {
                  borderColor:
                    state.selectedCityId === item.id
                      ? colors.primary
                      : colors.border,
                  backgroundColor:
                    state.selectedCityId === item.id
                      ? colors.softStrong
                      : colors.surfaceAlt,
                },
              ]}>
              <Text
                style={{
                  fontSize: textSize,
                  fontWeight: state.selectedCityId === item.id ? '700' : '400',
                  color: colors.text,
                }}>
                {item.name}
              </Text>
            </Pressable>
          ))}
        </View>
        {!city ? (
          <Text style={{fontSize: metaSize, color: colors.textMuted}}>
            Выберите город.
          </Text>
        ) : (
          <>
            <Text style={{fontSize: metaSize, color: colors.textMuted}}>
              {entry?.sizeBytes
                ? `Карта города · ${formatBytes(entry.sizeBytes)}`
                : 'Размер карты уточняется'}
            </Text>
            {ready ? (
              <View style={styles.row} testID="offline-city-ready">
                <Check color={colors.success} size={20} />
                <Text style={{fontSize: textSize, color: colors.text}}>
                  Доступна офлайн
                </Text>
              </View>
            ) : null}
            {entry?.savedAt ? (
              <Text style={{fontSize: metaSize, color: colors.textMuted}}>
                {entry.status === 'outdated' ? 'Нужно обновить' : 'Сохранена'} ·{' '}
                {new Date(entry.savedAt).toLocaleDateString('ru-RU')}
              </Text>
            ) : null}
            {downloading || paused ? (
              <View style={styles.content} accessibilityLiveRegion="polite">
                <View style={styles.progressLabel}>
                  <Text style={{fontSize: metaSize, color: colors.text}}>
                    {preparing
                      ? 'Подготовка карты'
                      : downloading
                        ? 'Скачивание'
                        : entry?.status === 'error'
                          ? 'Загрузка прервана'
                          : 'На паузе'}
                  </Text>
                  <Text style={{fontSize: metaSize, color: colors.text}}>
                    {progress}%
                  </Text>
                </View>
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel="Скачивание карты города"
                  accessibilityValue={{min: 0, max: 100, now: progress}}
                  testID="offline-city-progress"
                  style={[styles.progress, {backgroundColor: colors.border}]}>
                  <View
                    style={{
                      height: 5,
                      width: `${progress}%`,
                      backgroundColor: colors.primary,
                    }}
                  />
                </View>
              </View>
            ) : null}
          </>
        )}
        {error ? (
          <Text
            accessibilityRole="alert"
            style={{fontSize: metaSize, color: colors.dangerText}}>
            {error}
          </Text>
        ) : null}
        {isOffline ? (
          <Text style={{fontSize: metaSize, color: colors.textMuted}}>
            Для скачивания нужен интернет.
          </Text>
        ) : null}
        {state.busyCityId && state.busyCityId !== city?.id ? (
          <Text style={{fontSize: metaSize, color: colors.textMuted}}>
            Скачивается {getOfflineMapCity(state.busyCityId)?.name}.
          </Text>
        ) : null}
        <View style={styles.actions}>
          {downloading
            ? button(
                'Пауза',
                () => {
                  if (city) void state.pause(city.id);
                },
                deleting,
                false,
                <Pause color={colors.text} size={18} />,
                'offline-city-pause',
              )
            : button(
                paused
                  ? 'Продолжить'
                  : ready || entry?.status === 'outdated'
                    ? 'Обновить'
                    : 'Скачать',
                () => {
                  if (city)
                    void state.download(
                      city.id,
                      ready || entry?.status === 'outdated',
                    );
                },
                blocked,
                true,
                paused ? (
                  <Play color="#ffffff" size={18} />
                ) : ready || entry?.status === 'outdated' ? (
                  <RefreshCw color="#ffffff" size={18} />
                ) : (
                  <Download color="#ffffff" size={18} />
                ),
                'offline-city-download',
              )}
          {entry && entry.status !== 'available' && !downloading ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Удалить карту: ${city?.name}`}
              accessibilityState={{disabled: deleting || !!state.busyCityId}}
              disabled={deleting || !!state.busyCityId}
              onPress={() => {
                if (city) setDeleteCityId(city.id);
              }}
              testID="offline-city-delete"
              style={[
                styles.deleteButton,
                {backgroundColor: colors.surfaceAlt},
                (deleting || !!state.busyCityId) && styles.disabled,
              ]}>
              <Trash2 color={colors.textMuted} size={22} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <Actionsheet
        isOpen={!!deleteCityId}
        onClose={() => {
          if (!deleting) setDeleteCityId(null);
        }}>
        <ActionsheetBackdrop />
        <ActionsheetContent
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceRaised,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <Text
            style={{
              fontSize: textSize + 4,
              fontWeight: '800',
              color: colors.text,
            }}>
            Удалить карту?
          </Text>
          <Text
            style={{
              fontSize: textSize,
              color: colors.textMuted,
              marginTop: 12,
            }}>
            Карта «{deleteCity?.name}» будет удалена с этого устройства. Её
            можно скачать снова.
          </Text>
          <View style={[styles.actions, {marginTop: 24}]}>
            {button(
              'Отмена',
              () => setDeleteCityId(null),
              deleting,
              false,
              null,
              'offline-city-delete-cancel',
            )}
            {button(
              deleting ? 'Удаляем...' : 'Удалить',
              () => {
                if (deleteCity)
                  void state.remove(deleteCity.id).then(() => {
                    if (!useOfflineMapStore.getState().error)
                      setDeleteCityId(null);
                  });
              },
              deleting,
              true,
              deleting ? <ActivityIndicator color="#ffffff" /> : null,
              'offline-city-delete-confirm',
            )}
          </View>
          {state.error ? (
            <Text
              accessibilityRole="alert"
              style={{
                fontSize: metaSize,
                color: colors.dangerText,
                marginTop: 12,
              }}>
              {state.error}
            </Text>
          ) : null}
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
const styles = StyleSheet.create({
  content: {gap: 12},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  cities: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  city: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {opacity: 0.5},
  progressLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  progress: {height: 5, borderRadius: 3, overflow: 'hidden'},
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 0,
  },
});
