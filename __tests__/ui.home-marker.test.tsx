import React from 'react'
import { Platform } from 'react-native'
import { render, screen } from '@testing-library/react-native'

const mockMarkerMounts = jest.fn()
const mockMarkerUnmounts = jest.fn()

jest.mock('@fortawesome/react-native-fontawesome', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    FontAwesomeIcon: (props: any) => React.createElement(View, props),
  }
})

jest.mock('react-native-yamap-plus', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    Marker: ({ children, ...props }: any) => {
      React.useEffect(() => {
        mockMarkerMounts()
        return () => mockMarkerUnmounts()
      }, [])
      return React.createElement(View, { ...props, testID: 'home-marker' }, children)
    },
  }
})

import { HomeMarker } from '@/features/orders-map/ui/HomeMarker'

const point = {
  lat: 53.2,
  lon: 50.1,
  latitude: 53.2,
  longitude: 50.1,
  latitudeDelta: 0,
  longitudeDelta: 0,
}

describe('маркер дома на карте', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    mockMarkerMounts.mockClear()
    mockMarkerUnmounts.mockClear()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  })

  it('остаётся чёрным в светлой теме', async () => {
    await render(
      <HomeMarker
        point={point}
        getHome={jest.fn()}
        isDark={false}
      />,
    )

    expect(screen.getByTestId('orders-map-home-icon')).toHaveProp(
      'color',
      '#000000',
    )
    expect(screen.getByTestId('orders-map-home-icon')).toHaveProp('size', 20)
  })

  it('становится белым без дополнительных слоёв в тёмной теме', async () => {
    await render(
      <HomeMarker
        point={point}
        getHome={jest.fn()}
        isDark={true}
      />,
    )

    expect(screen.getByTestId('orders-map-home-icon')).toHaveProp(
      'color',
      '#FFFFFF',
    )
    expect(screen.getByTestId('orders-map-home-icon')).toHaveProp('size', 20)
  })

  it('на iPhone пересоздаёт только домик при переходе на светлую тему', async () => {
    const getHome = jest.fn()
    const view = await render(<HomeMarker point={point} getHome={getHome} isDark={true} />)

    expect(mockMarkerMounts).toHaveBeenCalledTimes(1)
    await view.rerender(<HomeMarker point={point} getHome={getHome} isDark={false} />)

    expect(mockMarkerUnmounts).toHaveBeenCalledTimes(1)
    expect(mockMarkerMounts).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('orders-map-home-icon')).toHaveProp('color', '#000000')
  })

  it('на Android меняет цвет без пересоздания маркера карты', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    const getHome = jest.fn()
    const view = await render(<HomeMarker point={point} getHome={getHome} isDark={true} />)

    await view.rerender(<HomeMarker point={point} getHome={getHome} isDark={false} />)

    expect(mockMarkerUnmounts).not.toHaveBeenCalled()
    expect(mockMarkerMounts).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('orders-map-home-icon')).toHaveProp('color', '#000000')
  })
})
