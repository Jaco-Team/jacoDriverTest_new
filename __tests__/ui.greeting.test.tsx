import React from 'react'
import { render } from '@testing-library/react-native'

const mockUseGreetingLogic = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}))

jest.mock('@/processes/auth/model/useGreetingLogic', () => ({
  useGreetingLogic: () => mockUseGreetingLogic(),
}))

import { Greeting } from '@/app/screens/Greeting'

describe('Greeting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('показывает новый стартовый экран во время проверки авторизации', async () => {
    const screen = await render(<Greeting />)

    expect(mockUseGreetingLogic).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('greeting-screen')).toBeTruthy()
    expect(screen.getByTestId('greeting-logo')).toBeTruthy()
    expect(screen.getByTestId('greeting-spinner')).toBeTruthy()
    expect(screen.getByText('Приложение курьера\nсети кафе Жако')).toBeTruthy()
  })
})
