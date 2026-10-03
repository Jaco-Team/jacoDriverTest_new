import { useStatStore, useGlobalStore, useOrdersStore, useSettingsStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

export function useOrdersList() {
  const [ FormatPrice ] = useStatStore(useShallow( state => [ state.FormatPrice ]));
  const getSettings = useSettingsStore(state => state.getSettings);
  const [globalFontSize, showAlertText, isGlobalLoading] = useGlobalStore(
    useShallow(state => [
      state.globalFontSize,
      state.showAlertText,
      state.loadSpinner,
    ]),
  );
  const [
    getOrders,
    orders,
    update_interval,
    actionButtonOrder,
    setActiveConfirm,
    isChecking,
    hasCachedOrders,
  ] = useOrdersStore(useShallow(state => [
    state.getOrders,
    state.orders,
    state.update_interval,
    state.actionButtonOrder,
    state.setActiveConfirm,
    state.is_check,
    Object.prototype.hasOwnProperty.call(
      state.ordersCache,
      state.ordersContextKey,
    ),
  ]));
  return {
    FormatPrice,
    globalFontSize,
    showAlertText,
    getOrders, 
    getSettings,
    orders, 
    hasCachedOrders,
    isChecking,
    isGlobalLoading,
    update_interval, 
    actionButtonOrder, 
    setActiveConfirm
  }
}
