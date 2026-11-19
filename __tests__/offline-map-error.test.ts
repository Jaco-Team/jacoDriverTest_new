import {getOfflineMapErrorMessage} from '@/features/offline-map/model/offlineMapError';

it('shows a readable Yandex network failure instead of a Java class address', () => {
  expect(getOfflineMapErrorMessage(new Error('com.yandex.runtime.network.internal.NetworkErrorBinding@49d0bb1')))
    .toBe('Не удалось связаться с сервером карт Яндекса. Проверьте интернет и повторите.');
});
it('preserves a specific actionable storage error', () => {
  expect(getOfflineMapErrorMessage(new Error('Недостаточно свободного места')))
    .toBe('Недостаточно свободного места');
});
