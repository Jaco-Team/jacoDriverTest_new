import { useShallow } from 'zustand/react/shallow'
import { useOrdersStore, useGlobalStore, useSettingsStore } from '@/shared/store/store'

export function useLimitLogic() {
  const [ getOrders, limit_summ, limit_count, selectType, type ] = useOrdersStore(
    useShallow( state => [ state.getOrders, state.limit_summ, state.limit_count, state.selectType, state.type ])
  );
  const [ globalFontSize ] = useGlobalStore(
    useShallow( state => [ state.globalFontSize ])
  );

  const [ night_map ] = useSettingsStore( useShallow( state => [ state.night_map ] ) )

  return {
    getOrders, limit_summ, limit_count, selectType, type, globalFontSize, night_map
  }
}