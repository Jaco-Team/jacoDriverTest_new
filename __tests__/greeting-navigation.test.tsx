import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

const mockReset = jest.fn()
const mockCheckToken = jest.fn()

jest.mock('@react-navigation/native', () => {
  const React = require('react')

  return {
    useNavigation: () => ({ reset: mockReset }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => callback(), [callback])
    },
  }
})

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}))

jest.mock('@/shared/store/store', () => ({
  useLoginStore: (selector: any) =>
    selector({ check_token: mockCheckToken }),
}))

import { useGreetingLogic } from '@/processes/auth/model/useGreetingLogic'

function Probe(): null {
  useGreetingLogic()
  return null
}

describe('навигация со стартового экрана', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    [true, 'List_orders'],
    [false, 'Auth'],
  ])('удаляет Greeting из истории при token=%s', async (token, route) => {
    mockCheckToken.mockResolvedValueOnce(token)

    await render(<Probe />)

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: route }],
      })
    })
  })
})
