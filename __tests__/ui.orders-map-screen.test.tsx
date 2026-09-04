import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'

const mockMapLogic = {
  mapRef: { current: null },
  zoom: 12,
  updateZoom: jest.fn(),
  getHome: jest.fn(),
  home: { lat: 53.2, lon: 50.1 },
  set_type_location: jest.fn(),
  type_location: 'none' as 'none' | 'location' | 'watch',
  driver_location_requesting: false,
  night_map: 0,
  is_scaleMap: 1,
  rotate_map: false,
  setRotateMap: jest.fn(),
  is_showModalTypeDop: false,
  isOpenOrderMap: false,
  trafficVisible: false,
  toggleTrafficVisible: jest.fn(),
  mapInitStatus: 'ready',
  mapInstanceKey: 0,
  handleMapLoaded: jest.fn(),
  retryMap: jest.fn(),
  shouldRenderMap: true,
}

jest.mock('@/features/orders-map/model/useMapLogic', () => ({
  useMapLogic: () => mockMapLogic,
}))

jest.mock('react-native-yamap-plus', () => {
  const React = require('react')
  const { View } = require('react-native')
  return React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement(View, { ...props, ref, testID: 'native-yandex-map' }, children),
  )
})

jest.mock('@fortawesome/react-native-fontawesome', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    FontAwesomeIcon: (props: any) => React.createElement(View, props),
  }
})

jest.mock('@/components/ui/slider', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    Slider: ({ children, ...props }: any) =>
      React.createElement(View, { ...props, testID: 'map-zoom-slider' }, children),
    SliderThumb: View,
    SliderTrack: View,
    SliderFilledTrack: View,
  }
})

jest.mock('@/features/orders-map/ui/Limit', () => ({
  TypeLimit: () => null,
}))
jest.mock('@/features/orders-map/ui/ListOrders', () => ({
  ListOrders: () => null,
}))
jest.mock('@/features/orders-map/ui/HomeMarker', () => ({
  HomeMarker: () => null,
}))
jest.mock('@/features/orders-map/ui/ModalOrder', () => ({
  ModalOrder: () => null,
}))
jest.mock('@/features/orders-map/ui/DriverMarker', () => ({
  DriverMarker: () => null,
  DriverMarkerImage: () => null,
}))
jest.mock('@/features/orders-map/ui/ModalFilterOrders', () => ({
  ModalFilterOrders: () => null,
}))

import { MapScreen } from '@/features/orders-map/ui/MapScreen'

describe('экран карты заказов', () => {
  beforeEach(() => {
    mockMapLogic.type_location = 'none'
    mockMapLogic.driver_location_requesting = false
    mockMapLogic.set_type_location.mockClear()
  })

  it('занимает всю доступную область и сохраняет собственные элементы карты', async () => {
    await render(<MapScreen />)
    await act(async () => {
      fireEvent(screen.getByTestId('orders-map-viewport'), 'layout', {
        nativeEvent: { layout: { width: 390, height: 700 } },
      })
    })

    expect(screen.getByTestId('orders-map-screen')).toHaveStyle({
      flex: 1,
      overflow: 'hidden',
    })
    expect(screen.getByTestId('native-yandex-map')).toBeTruthy()
    expect(screen.getByTestId('map-zoom-slider')).toBeTruthy()
    expect(screen.getByTestId('orders-map-rotation-lock')).toBeTruthy()
    expect(screen.getByTestId('orders-map-driver-location')).toBeTruthy()
    expect(screen.getByTestId('orders-map-traffic')).toBeTruthy()
  })

  it('использует тот же трёхрежимный обработчик геолокации, что и сайт', async () => {
    await render(<MapScreen />)

    fireEvent.press(screen.getByTestId('orders-map-driver-location'))

    expect(mockMapLogic.set_type_location).toHaveBeenCalledTimes(1)
  })

  it('меняет иконку вместе с режимом геолокации, как на сайте', async () => {
    const view = await render(<MapScreen />)

    expect(screen.getByTestId('orders-map-driver-location-icon').props.icon.iconName).toBe(
      'location-pin-lock',
    )

    mockMapLogic.type_location = 'location'
    await view.rerender(<MapScreen />)
    expect(screen.getByTestId('orders-map-driver-location-icon').props.icon.iconName).toBe(
      'location-dot',
    )

    mockMapLogic.type_location = 'watch'
    await view.rerender(<MapScreen />)
    expect(screen.getByTestId('orders-map-driver-location-icon').props.icon.iconName).toBe(
      'location-pin',
    )
  })

  it('оставляет иконку геопозиции на месте во время поиска координаты', async () => {
    mockMapLogic.driver_location_requesting = true

    await render(<MapScreen />)

    expect(screen.getByTestId('orders-map-driver-location-icon')).toBeTruthy()
    expect(screen.getByTestId('orders-map-driver-location').props.disabled).toBe(true)
  })

  it('не добавляет локальные кнопки фильтра и обновления поверх карты', async () => {
    await render(<MapScreen />)

    expect(screen.queryByTestId('orders-map-filter')).toBeNull()
    expect(screen.queryByTestId('orders-map-refresh')).toBeNull()
  })
})
