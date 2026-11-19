export function getOfflineMapErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes('NetworkErrorBinding') || text.includes('NetworkError')) {
    return 'Не удалось связаться с сервером карт Яндекса. Проверьте интернет и повторите.';
  }
  if (/com\.yandex\./.test(text)) {
    return 'Не удалось загрузить карту Яндекса. Повторите попытку.';
  }
  return text;
}
