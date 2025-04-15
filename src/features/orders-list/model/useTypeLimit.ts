import { useGlobalStore, useOrdersStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

export function useTypeLimit() {
  const [ getOrders, limit_summ, limit_count ] = useOrdersStore(useShallow( state => [ state.getOrders, state.limit_summ, state.limit_count ]));
  const [ globalFontSize ] = useGlobalStore(useShallow( state => [ state.globalFontSize ]));

  return {
    getOrders, 
    limit_summ, 
    limit_count,
    globalFontSize
  }
}