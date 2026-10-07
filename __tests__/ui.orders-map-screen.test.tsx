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
  isOffline: false,
}
const mockMapMount = jest.fn()
const mockMapUnmount = jest.fn()
const mockHomeMarkerMount = jest.fn()
const mockHomeMarkerUnmount = jest.fn()

const mockTheme = {
  colors: {
    surface: '#F4F7FA',
    surfaceRaised: '#FFFFFF',
    softStrong: 'rgba(66, 98, 125, 0.14)',
    border: 'rgba(66, 98, 125, 0.16)',
    primary: '#42627D',
    text: '#1F2D38',
    textMuted: '#6B7883',
    shadowStrong: 'rgba(17, 27, 36, 0.18)',
  },
  isDark: false,
}

jest.mock('@/shared/theme/AppThemeProvider', () => ({
  useAppTheme: () => mockTheme,
}))

jest.mock('@/features/orders-map/model/useMapLogic', () => ({
  useMapLogic: () => mockMapLogic,
}))

jest.mock('react-native-yamap-plus', () => {
  const React = require('react')
  const { View } = require('react-native')
  return React.forwardRef(({ children, ...props }: any, ref: any) => {
    React.useEffect(() => {
      mockMapMount()
      return mockMapUnmount
    }, [])
    return React.createElement(View, { ...props, ref, testID: 'native-yandex-map' }, children)
  })
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
  OrderMarkerImageSources: () => null,
  useOrderMarkerImages: () => ({images: {}, onImage: jest.fn(), setImages: jest.fn()}),
}))
jest.mock('@/features/orders-map/ui/HomeMarker', () => ({
  HomeMarkerImage: () => null,
  HomeMarker: ({ point, refreshKey }: any) => {
    const React = require('react')
    const { View } = require('react-native')
    React.useEffect(() => {
      mockHomeMarkerMount()
      return mockHomeMarkerUnmount
    }, [refreshKey])
    return React.createElement(View, {
      testID: 'orders-map-home-marker',
      point,
      refreshKey,
    })
  },
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
jest.mock('@/features/orders-map/ui/OrdersMapCompass', () => ({
  OrdersMapCompass: () => null,
}))

import { MapScreen } from '@/features/orders-map/ui/MapScreen'
import {ConnectivityContext} from '@/shared/lib/connectivityContext'
import {useOfflineMapStore} from '@/features/offline-map/model/offlineMap.store'
import {useOrdersStore} from '@/shared/store/store'

describe('экран карты заказов', () => {
  beforeEach(() => {
    mockMapLogic.home = { lat: 53.2, lon: 50.1 }
    mockMapLogic.type_location = 'none'
    mockMapLogic.driver_location_requesting = false
    mockMapLogic.set_type_location.mockClear()
    mockTheme.isDark = false
    mockMapLogic.isOffline = false
    useOfflineMapStore.setState({hydrated: false, cities: {}})
    mockMapMount.mockClear()
    mockMapUnmount.mockClear()
    mockHomeMarkerMount.mockClear()
    mockHomeMarkerUnmount.mockClear()
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
    expect(screen.getByTestId('native-yandex-map').props.nightMode).toBe(false)
    expect(screen.getByTestId('map-zoom-slider')).toBeTruthy()
    expect(screen.getByTestId('orders-map-rotation-lock')).toBeTruthy()
    expect(screen.getByTestId('orders-map-driver-location')).toBeTruthy()
    expect(screen.getByTestId('orders-map-traffic')).toBeTruthy()
    expect(typeof screen.getByTestId('native-yandex-map').props.onCameraPositionChangeEnd).toBe(
      'function',
    )
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

  it('не передаёт карте некорректную домашнюю координату', async () => {
    mockMapLogic.home = { lat: Number.NaN, lon: 50.1 }

    await render(<MapScreen />)
    await act(async () => {
      fireEvent(screen.getByTestId('orders-map-viewport'), 'layout', {
        nativeEvent: { layout: { width: 390, height: 700 } },
      })
    })

    expect(screen.getByTestId('native-yandex-map').props.initialRegion).toBeUndefined()
    expect(screen.queryByTestId('orders-map-home-marker')).toBeNull()
  })

  it('включает тёмный режим Яндекс-карты вместе с темой приложения', async () => {
    mockTheme.isDark = true

    await render(<MapScreen />)
    await act(async () => {
      fireEvent(screen.getByTestId('orders-map-viewport'), 'layout', {
        nativeEvent: { layout: { width: 390, height: 700 } },
      })
    })

    expect(screen.getByTestId('native-yandex-map').props.nightMode).toBe(true)
  })

  it('показывает офлайн-плашку поверх карты без изменения её геометрии и пересоздания', async () => {
    function Probe() {
      return <ConnectivityContext.Provider value={mockMapLogic.isOffline}>
        <MapScreen />
      </ConnectivityContext.Provider>
    }
    const view = await render(<Probe />)
    await fireEvent(screen.getByTestId('orders-map-viewport'), 'layout', {
      nativeEvent: {layout: {width: 390, height: 700}},
    })
    const mapStyle = screen.getByTestId('native-yandex-map').props.style
    const viewportStyle = screen.getByTestId('orders-map-viewport').props.style
    expect(screen.getByTestId('orders-map-viewport')).toHaveStyle({flex: 1})
    expect(viewportStyle.width).toBeUndefined()
    expect(viewportStyle.height).toBeUndefined()

    for (let cycle = 0; cycle < 3; cycle++) {
      mockMapLogic.isOffline = true
      await view.rerender(<Probe />)
      expect(screen.getByText('Нет подключения к интернету')).toBeTruthy()
      expect(screen.getByTestId('orders-map-offline-banner')).toHaveStyle({
        position: 'absolute', top: 0, left: 0, right: 0,
      })
      expect(screen.getByTestId('orders-map-offline-banner').props.pointerEvents).toBe('none')
      await fireEvent(screen.getByTestId('orders-map-offline-banner'), 'layout', {
        nativeEvent: {layout: {height: 64}},
      })
      expect(screen.getByTestId('orders-map-rotation-lock')).toHaveStyle({top: 74})
      expect(screen.queryByTestId('orders-map-driver-location')).toBeNull()
      expect(screen.getByTestId('native-yandex-map').props.style).toEqual(mapStyle)
      expect(screen.getByTestId('orders-map-viewport').props.style).toEqual(viewportStyle)

      mockMapLogic.isOffline = false
      await view.rerender(<Probe />)
      expect(screen.queryByTestId('orders-map-offline-banner')).toBeNull()
      expect(screen.getByTestId('orders-map-rotation-lock')).toHaveStyle({top: 10})
      expect(screen.getByTestId('orders-map-driver-location')).toBeTruthy()
    }
    expect(mockMapMount).toHaveBeenCalledTimes(1)
    expect(mockMapUnmount).not.toHaveBeenCalled()
    expect(mockHomeMarkerMount).toHaveBeenCalledTimes(7)
    expect(mockHomeMarkerUnmount).toHaveBeenCalledTimes(6)
  })

  it('без скачанной карты показывает сохранённые заказы списком и не монтирует MapKit', async () => {
    const showOrdersMap = jest.fn()
    useOfflineMapStore.setState({hydrated: true, cities: {}})
    useOrdersStore.setState({
      type: {id: 5, text: 'У других курьеров'},
      orders: [
        {
          id: 71,
          addr: 'улица Мира, 82',
          id_text: '#71',
          status: 'В пути',
          point_color: '#b5e737',
          color: '#a9203e',
          xy: {lat: 53.2, lon: 50.1},
        } as any,
      ],
      showOrdersMap,
    })
    mockMapLogic.isOffline = true

    await render(
      <ConnectivityContext.Provider value>
        <MapScreen />
      </ConnectivityContext.Provider>,
    )

    expect(screen.getByText('Карта недоступна')).toBeTruthy()
    expect(screen.getByText('улица Мира, 82')).toBeTruthy()
    expect(screen.queryByTestId('native-yandex-map')).toBeNull()
    expect(screen.queryByTestId('orders-map-rotation-lock')).toBeNull()

    fireEvent.press(screen.getByTestId('orders-map-offline-order-71'))
    expect(showOrdersMap).toHaveBeenCalledWith(71)
  })

  it('без скачанной карты и заказов показывает единое пустое состояние', async () => {
    useOfflineMapStore.setState({hydrated: true, cities: {}})
    useOrdersStore.setState({
      type: {id: 3, text: 'Активные'},
      orders: [],
    })
    mockMapLogic.isOffline = true

    await render(
      <ConnectivityContext.Provider value>
        <MapScreen />
      </ConnectivityContext.Provider>,
    )

    expect(screen.getByText('Карта недоступна')).toBeTruthy()
    expect(screen.getByText('Сохранённых заказов нет.')).toBeTruthy()
    expect(screen.queryByTestId('native-yandex-map')).toBeNull()
  })

  it('со скачанной картой текущего города оставляет MapKit доступным офлайн', async () => {
    useOfflineMapStore.setState({
      hydrated: true,
      cities: {
        samara: {
          regionId: 51,
          status: 'ready',
          progress: 1,
          managed: true,
          autoResume: false,
        },
      },
    })
    mockMapLogic.isOffline = true

    await render(
      <ConnectivityContext.Provider value>
        <MapScreen />
      </ConnectivityContext.Provider>,
    )
    await act(async () => {
      fireEvent(screen.getByTestId('orders-map-viewport'), 'layout', {
        nativeEvent: {layout: {width: 390, height: 700}},
      })
    })

    expect(screen.getByTestId('native-yandex-map')).toBeTruthy()
    expect(screen.queryByText('Карта недоступна')).toBeNull()
  })
})
