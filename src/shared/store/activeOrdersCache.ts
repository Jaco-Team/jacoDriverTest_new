import AsyncStorage from '@react-native-async-storage/async-storage';
import { GetOrdersResponse } from './OrdersStoreType';

const KEY = 'active-orders-v1';

type Snapshot = { token: string; savedAt: number; data: GetOrdersResponse };

export async function readActiveOrders(token: string): Promise<Snapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value?.token === token && Number.isFinite(value.savedAt) &&
      Array.isArray(value.data?.orders) &&
      value.data.orders.every((order: unknown) => order !== null && typeof order === 'object' &&
        'status' in order && typeof order.status === 'string') ? value : null;
  } catch {
    return null;
  }
}

export async function saveActiveOrders(token: string, data: GetOrdersResponse, savedAt: number) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ token, data, savedAt }));
    return true;
  } catch {
    return false;
  }
}
