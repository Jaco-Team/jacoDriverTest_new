type InteractionTask = (() => unknown) | {run?: () => unknown; gen?: () => Promise<unknown>}

type InteractionHandle = number

type ScheduledTask = {
  then: Promise<unknown>['then']
  done: () => void
  cancel: () => void
}

function runTask(task?: InteractionTask) {
  if (typeof task === 'function') {
    return task()
  }
  if (task?.gen) {
    return task.gen()
  }
  return task?.run?.()
}

export const interactionManagerCompat = {
  createInteractionHandle(): InteractionHandle {
    return 1
  },

  clearInteractionHandle(_handle: InteractionHandle) {},

  runAfterInteractions(task?: InteractionTask): ScheduledTask {
    let cancelled = false
    const g = globalThis as typeof globalThis & {
      requestIdleCallback?: (callback: () => void) => number
      cancelIdleCallback?: (handle: number) => void
    }

    const promise = new Promise(resolve => {
      const run = () => {
        if (cancelled) {
          resolve(undefined)
          return
        }
        resolve(runTask(task))
      }

      if (typeof g.requestIdleCallback === 'function') {
        g.requestIdleCallback(run)
        return
      }

      setTimeout(run, 0)
    })

    return {
      then: promise.then.bind(promise),
      done: () => {},
      cancel: () => {
        cancelled = true
      },
    }
  },
}

export function installInteractionManagerCompat() {
  // RN 0.87 throws on InteractionManager in __DEV__; release leaves it undefined.
  // react-native-drawer-layout 4.x still calls createInteractionHandle on drawer gestures.
  const ReactNative = require('react-native') as Record<string, unknown>

  Object.defineProperty(ReactNative, 'InteractionManager', {
    configurable: true,
    enumerable: true,
    get: () => interactionManagerCompat,
  })
}

installInteractionManagerCompat()
