import { useShallow } from 'zustand/react/shallow'
import { useOrdersStore, useGlobalStore } from '@/shared/store/store'

export function useListOrdersLogic() {
  const [ orders, showOrdersMap ] = useOrdersStore(
    useShallow( state => [ state.orders, state.showOrdersMap ])
  );
  const [ globalFontSize, mapScale, theme ] = useGlobalStore(
    useShallow( state => [ state.globalFontSize, state.mapScale, state.theme ])
  );

  return {
    orders, showOrdersMap, globalFontSize, mapScale, theme
  }
}