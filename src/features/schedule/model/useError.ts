import { useStatStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'

export function useErrorCamera() {
  const [ globalFontSize ] = useGlobalStore(useShallow( state => [ state.globalFontSize ]));
  
  const [ err_cam, showModalErrCam ] = useStatStore(useShallow( state => [ state.err_cam, state.showModalErrCam ] ));

  return {
    err_cam,
    showModalErrCam,
    globalFontSize
  }
}

export function useErrorOrders() {
  const [ globalFontSize ] = useGlobalStore(useShallow( state => [ state.globalFontSize ]));
  
  const [ err_orders, showModalErrOrder ] = useStatStore(useShallow( state => [ state.err_orders, state.showModalErrOrder ] ));

  return {
    err_orders,
    showModalErrOrder,
    globalFontSize
  }
}