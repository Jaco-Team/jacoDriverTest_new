import {createContext, useContext} from 'react'

export const ConnectivityContext = createContext(false)

export function useIsOffline(): boolean {
  return useContext(ConnectivityContext)
}
