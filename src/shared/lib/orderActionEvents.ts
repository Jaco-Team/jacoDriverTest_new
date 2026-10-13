export type SuccessfulOrderActionType = 'take' | 'cancel' | 'finish'

export interface SuccessfulOrderAction {
  orderId: number
  type: SuccessfulOrderActionType
}

type Listener = (action: SuccessfulOrderAction) => void
type TakeStartedListener = (orderId: number) => void

const listeners = new Set<Listener>()
const takeStartedListeners = new Set<TakeStartedListener>()

export function emitOrderTakeStarted(orderId: number): void {
  takeStartedListeners.forEach(listener => listener(orderId))
}

export function subscribeOrderTakeStarted(listener: TakeStartedListener): () => void {
  takeStartedListeners.add(listener)
  return () => takeStartedListeners.delete(listener)
}

export function emitSuccessfulOrderAction(action: SuccessfulOrderAction): void {
  listeners.forEach(listener => listener(action))
}

export function subscribeSuccessfulOrderAction(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
