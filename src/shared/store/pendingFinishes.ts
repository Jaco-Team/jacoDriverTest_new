import {useOrdersStore} from './ordersStore';
import {useGlobalStore} from './globalStore';
import {useSettingsStore} from './settingsStore';
import {emitSuccessfulOrderAction} from '@/shared/lib/orderActionEvents';
import {useSyncExternalStore} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createFinishQueue} from '@/shared/lib/finishQueue';
import {isAppOffline} from '@/shared/lib/connectivityState';
import {api} from './api';
import {useLoginStore} from './loginStore';

const QUEUE_KEY = 'jaco_driver_pending_finishes_v1';
export function finishOwner(): string | null {
  const user = useLoginStore.getState().currentUser;
  const owner = user?.user_id ?? user?.login;
  return owner == null ? null : String(owner);
}
export const pendingFinishes = createFinishQueue({
  read: () => AsyncStorage.getItem(QUEUE_KEY),
  write: value => AsyncStorage.setItem(QUEUE_KEY, value),
  owner: finishOwner,
  session: finishOwner,
  online: () => !isAppOffline(),
  retainAcknowledged: true,
  acknowledged: (entry, newlyAcknowledged) => {
    if (useSettingsStore.getState().point_id !== entry.pointId) return;
    if (newlyAcknowledged) emitSuccessfulOrderAction({orderId: entry.orderId, type: 'finish'});
    void useOrdersStore.getState().getOrders().catch(() => undefined);
  },
  rejected: (entry, text) => {
    useGlobalStore.getState().showModalText(true, `Заказ #${entry.orderId}: ${text}`);
  },
  send: async entry => {
    const response = await api('orders', {type: 'actionOrder', id: entry.orderId, point_id: entry.pointId,
      type_action: 3, completed_at: entry.completedAt, latitude: entry.latitude, longitude: entry.longitude,
      expected_owner: entry.owner});
    return {ok: response.st === true, retryable: response.retryable === true || response.text.includes('Сессия истекла'), text: response.text};
  },
});
export function usePendingFinish(pointId: number | null, orderId: number) {
  useSyncExternalStore(pendingFinishes.subscribe, pendingFinishes.revision, () => 0);
  return pendingFinishes.find(finishOwner(), pointId, orderId);
}
