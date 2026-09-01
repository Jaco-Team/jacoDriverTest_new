import React, { useEffect } from 'react'

import { useStatStore, useGlobalStore, useOrdersStore, useSettingsStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import { useFocusEffect } from '@react-navigation/native';

export function useOrdersList() {
  const [ FormatPrice ] = useStatStore(useShallow( state => [ state.FormatPrice ]));
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
  ] = useOrdersStore(useShallow(state => [
    state.getOrders,
    state.orders,
    state.update_interval,
    state.actionButtonOrder,
    state.setActiveConfirm,
    state.is_check,
  ]));
  const [getSettings] = useSettingsStore(useShallow(state => [state.getSettings]));

  useFocusEffect(
    React.useCallback(() => {
      getSettings();
    }, [getSettings])
  );

  useEffect(() => {
    getSettings();
  }, [getSettings]);

  return {
    FormatPrice,
    globalFontSize,
    showAlertText,
    getOrders, 
    orders, 
    isChecking,
    isGlobalLoading,
    update_interval, 
    actionButtonOrder, 
    setActiveConfirm
  }
}
