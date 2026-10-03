import React from 'react'
import { act, render } from '@testing-library/react-native'

import { useOrdersBackgroundUpdater } from '@/shared/lib/useOrdersBackgroundUpdater'

function TestComponent({
  prefetchOrders,
  cacheKey = '["user",1,1]',
  hasCurrentCache = true,
  isPaused = false,
  isChecking = false,
}: {
  prefetchOrders: (warmAll?: boolean) => Promise<void>
  cacheKey?: string
  hasCurrentCache?: boolean
  isPaused?: boolean
  isChecking?: boolean
}) {
  useOrdersBackgroundUpdater(
    prefetchOrders,
    cacheKey,
    hasCurrentCache,
    isPaused,
    isChecking,
  )
  return null
}

describe('useOrdersBackgroundUpdater', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('один раз прогревает остальные разделы после загрузки текущего без фонового опроса скрытых экранов', async () => {
    const prefetchOrders = jest.fn(async () => undefined)
    const view = await render(<TestComponent prefetchOrders={prefetchOrders} />)

    expect(prefetchOrders).toHaveBeenNthCalledWith(1, true)

    await act(async () => {
      jest.advanceTimersByTime(5 * 60_000)
    })

    expect(prefetchOrders).toHaveBeenCalledTimes(1)
    await view.unmount()
  })

  it('не начинает прогрев до завершения текущего запроса', async () => {
    const prefetchOrders = jest.fn(async () => undefined)
    const view = await render(
      <TestComponent prefetchOrders={prefetchOrders} isChecking />,
    )

    expect(prefetchOrders).not.toHaveBeenCalled()

    await view.rerender(
      <TestComponent prefetchOrders={prefetchOrders} isChecking={false} />,
    )

    expect(prefetchOrders).toHaveBeenCalledWith(true)
    await view.unmount()
  })
})
