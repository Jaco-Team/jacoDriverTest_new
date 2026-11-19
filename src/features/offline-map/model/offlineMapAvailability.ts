import type {CityDownload} from './offlineMap.store';

export function isOfflineCityUsable(entry: CityDownload | undefined): boolean {
  // Legacy in-memory ready entries are accepted; hydrate explicitly marks all
  // disk entries checking before the SDK validates them.
  return entry?.availability === 'ready' ||
    (entry?.availability === undefined && entry?.status === 'ready');
}

export function getOfflineCityUnavailableReason(entry: CityDownload | undefined): string {
  if (entry?.availability === 'checking') return 'Проверяем сохранённую карту.';
  if (entry?.availability === 'invalid') return 'Сохранённая карта непригодна. Скачайте её заново.';
  if (entry && ['paused', 'downloading', 'error'].includes(entry.status))
    return 'Карта скачана не полностью. Продолжите скачивание с интернетом.';
  return 'Карта этого города не скачана. Скачайте её с интернетом.';
}
