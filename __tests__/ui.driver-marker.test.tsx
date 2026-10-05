import React, { useState } from 'react'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native'

let mockDriverMarkerState: any
let mockSvgCaptureOptions: { width: number; height: number } | null
let mockIsDark = false

jest.mock('@/shared/theme/AppThemeProvider', () => ({
  useAppTheme: () => ({ isDark: mockIsDark }),
}))

jest.mock('@/features/orders-map/model/useDriverMarkerLogic', () => ({
  useDriverMarkerLogic: () => mockDriverMarkerState,
}))

jest.mock('react-native-yamap-plus', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    Marker: ({ point, scale, source, visible, anchor }: any) =>
      React.createElement(View, {
        testID: 'orders-map-driver-native-marker',
        point,
        scale,
        source,
        visible,
        anchor,
      }),
  }
})

jest.mock('react-native-svg', () => {
  const React = require('react')
  const { Text, View } = require('react-native')

  const Svg = React.forwardRef(({ children, onLayout }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      toDataURL: (
        callback: (base64: string) => void,
        options: { width: number; height: number },
      ) => {
        mockSvgCaptureOptions = options
        callback('driver-marker-base64')
      },
    }))

    return React.createElement(
      View,
      { testID: 'orders-map-driver-svg', onLayout },
      children,
    )
  })

  return {
    __esModule: true,
    default: Svg,
    G: ({ children }: any) => React.createElement(View, null, children),
    Path: () => React.createElement(View),
    Rect: () => React.createElement(View),
    Text: ({ children, ...props }: any) => React.createElement(Text, props, children),
  }
})

import {getMarkerCaptureSize} from '@/features/orders-map/ui/MeasuredMarkerImage'

import {
  DriverMarker,
  DriverMarkerImage,
  getDriverMarkerNativeScale,
  getMarkerPalette,
  type DriverMarkerImageSource,
} from '@/features/orders-map/ui/DriverMarker'

function DriverMarkerProbe() {
  const [image, setImage] = useState<DriverMarkerImageSource | null>(null)

  return (
    <>
      <DriverMarkerImage onImage={setImage} />
      <DriverMarker image={image} />
    </>
  )
}

describe('DriverMarker', () => {
  beforeEach(() => {
    mockSvgCaptureOptions = null
    mockIsDark = false
    mockDriverMarkerState = {
      location_driver: { lon: 49.40071, lat: 53.529781 },
      location_driver_time_text: '16:10',
      globalFontSize: 16,
      mapScale: 1,
      theme: 'white',
    }
  })

  afterEach(async () => {
    await cleanup()
    jest.restoreAllMocks()
  })

  it('не создаёт изображение и держит скрытый маркер до получения координат', async () => {
    mockDriverMarkerState = {
      ...mockDriverMarkerState,
      location_driver: null,
    }

    const screen = await render(<DriverMarker image={null} />)

    const marker = screen.getByTestId('orders-map-driver-native-marker')
    expect(marker.props.visible).toBe(false)
    expect(marker.props.point).toEqual({ lat: 0, lon: 0 })
  })

  it('не передаёт нативной карте некорректную координату курьера', async () => {
    mockDriverMarkerState = {
      ...mockDriverMarkerState,
      location_driver: { lat: Number.NaN, lon: 49.40071 },
    }

    const screen = await render(<DriverMarker image={null} />)

    const marker = screen.getByTestId('orders-map-driver-native-marker')
    expect(marker.props.visible).toBe(false)
    expect(marker.props.point).toEqual({ lat: 0, lon: 0 })
  })

  it('создаёт PNG и передаёт его вместе с координатами нативному маркеру', async () => {
    const screen = await render(<DriverMarkerProbe />)

    expect(screen.getByTestId('orders-map-driver-native-marker').props.source.uri).toContain(
      'data:image/png;base64,',
    )

    await act(async () => {
      fireEvent(screen.getByTestId('orders-map-driver-marker-source-measure'), 'textLayout', {nativeEvent: {lines: [{width: 40, height: 19, ascender: 15}]}})
    })
    await act(async () => {
      fireEvent(screen.getByTestId('orders-map-driver-svg'), 'layout')
    })

    await waitFor(() => {
      const marker = screen.getByTestId('orders-map-driver-native-marker')
      expect(marker.props.point).toEqual({ lon: 49.40071, lat: 53.529781 })
      expect(marker.props.scale).toBe(1)
      expect(marker.props.anchor.x * 84).toBeCloseTo(12)
      expect(marker.props.anchor.y).toBe(0.5)
      expect(marker.props.source).toEqual({
        uri: 'data:image/png;base64,driver-marker-base64',
      })
    })
    expect(mockSvgCaptureOptions).toEqual({ width: 84, height: 32 })
    expect(screen.getAllByText('16:10').find(node => node.props.fontSize === 16)).toBeTruthy()
    expect(screen.getAllByText('16:10').find(node => node.props.fontWeight === '400')).toBeTruthy()
  })

  it('компенсирует плотность Android для PNG и резервной метки', () => {
    expect(getMarkerCaptureSize(96, 32, 'android', 3.75)).toEqual({
      width: 360,
      height: 120,
    })
    expect(getDriverMarkerNativeScale(1, false, 'android', 3.75)).toBe(1.125)
    expect(getDriverMarkerNativeScale(1, true, 'android', 3.75)).toBe(1)
  })

  it.each([
    ['transparent_white', false, '#000000'],
    ['transparent', true, '#FFFFFF'],
  ] as const)(
    'делает прозрачную подпись %s контрастной для темы isDark=%s',
    (theme, isDark, expectedColor) => {
      expect(getMarkerPalette(theme, isDark).text).toBe(expectedColor)
    },
  )

})
