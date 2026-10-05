import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import type {Theme} from '@/shared/types/globalTypes';

let mockIsDark = false;
let mockLogic: any;
const mockMount = jest.fn();
const mockUnmount = jest.fn();
const mockCaptures: Array<{
  callback: (value: string) => void;
  options: {width: number; height: number};
}> = [];

jest.mock('@/shared/theme/AppThemeProvider', () => ({
  useAppTheme: () => ({isDark: mockIsDark}),
}));
jest.mock('@/features/orders-map/model/useListOrdersLogic', () => ({
  useListOrdersLogic: () => mockLogic,
}));
jest.mock('react-native-yamap-plus', () => {
  const R = require('react');
  const {View} = require('react-native');
  return {
    Marker: (props: any) => {
      R.useEffect(() => {
        mockMount();
        return mockUnmount;
      }, []);
      return R.createElement(View, props);
    },
  };
});
jest.mock('react-native-svg', () => {
  const R = require('react');
  const {View, Text} = require('react-native');
  const Svg = R.forwardRef((props: any, ref: any) => {
    R.useImperativeHandle(ref, () => ({
      toDataURL: (callback: (value: string) => void, options: any) =>
        mockCaptures.push({callback, options}),
    }));
    return R.createElement(View, props, props.children);
  });
  return {
    __esModule: true,
    default: Svg,
    G: View,
    Path: View,
    Rect: View,
    Text,
  };
});

import {
  OrderMarker,
  OrderMarkerImage,
} from '@/features/orders-map/ui/OrderMarker';
import {ListOrders} from '@/features/orders-map/ui/ListOrders';
import {
  getMarkerCaptureSize,
  type MarkerBitmap,
} from '@/features/orders-map/ui/MeasuredMarkerImage';

const bitmap: MarkerBitmap = {
  signature: 'initial',
  source: {uri: 'data:image/png;base64,a'},
  width: 120,
  height: 30,
  anchor: {x: 10 / 120, y: 0.5},
};
const baseItem = {
  id: 1,
  xy: {lat: 53.2, lon: 50.1},
  point_text: '15:49 (35 мин.)',
  point_color: 'green',
  to_time_sec_min: 35,
  close_time_: 0,
} as any;
const base = {
  item: baseItem,
  theme: 'white_border' as Theme,
  globalFontSize: 16,
  mapScale: 1,
  showOrdersMap: jest.fn(),
};

beforeEach(() => {
  mockIsDark = false;
  mockCaptures.length = 0;
  mockMount.mockClear();
  mockUnmount.mockClear();
  mockLogic = {...base, orders: [baseItem]};
});

it.each([
  'classic',
  'transparent',
  'transparent_white',
  'white',
  'white_border',
  'black',
] as Theme[])(
  'измеряет длинную подпись и полностью вмещает рамку: %s',
  async theme => {
    const onImage = jest.fn();
    const probe = await render(
      <OrderMarkerImage
        {...base}
        theme={theme}
        globalFontSize={28}
        onImage={onImage}
      />,
    );
    expect(probe.queryByTestId('order-marker-image-1-svg')).toBeNull();
    await fireEvent(
      probe.getByTestId('order-marker-image-1-measure'),
      'textLayout',
      {nativeEvent: {lines: [{width: 305.7, height: 33, ascender: 26}]}},
    );
    const svg = probe.getByTestId('order-marker-image-1-svg');
    const expectedWidth =
      20 +
      (theme === 'classic' ? 0 : 4) +
      306 +
      16 +
      (theme === 'black' || theme === 'white_border' ? 2 : 0);
    expect(svg.props.width).toBe(expectedWidth);
    expect(svg.props.height).toBeGreaterThanOrEqual(41);
    await fireEvent(svg, 'layout');
    expect(mockCaptures).toHaveLength(1);
    await act(async () => {
      mockCaptures[0].callback('new');
    });
    expect(onImage).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expectedWidth,
        source: {uri: 'data:image/png;base64,new'},
      }),
    );
  },
);

it('отбрасывает запоздалый PNG и измерение после смены текста/цвета/темы', async () => {
  const onImage = jest.fn();
  const probe = await render(<OrderMarkerImage {...base} onImage={onImage} />);
  const oldMeasure = probe.getByTestId('order-marker-image-1-measure').props
    .onTextLayout;
  await fireEvent(
    probe.getByTestId('order-marker-image-1-measure'),
    'textLayout',
    {nativeEvent: {lines: [{width: 100, height: 19}]}},
  );
  await fireEvent(probe.getByTestId('order-marker-image-1-svg'), 'layout');
  await probe.rerender(
    <OrderMarkerImage
      {...base}
      theme="black"
      item={{...baseItem, point_text: '16:10 (50 мин.)', point_color: 'red'}}
      onImage={onImage}
    />,
  );
  await act(async () => {
    oldMeasure({nativeEvent: {lines: [{width: 800, height: 40}]}});
    mockCaptures[0].callback('old');
  });
  expect(onImage).not.toHaveBeenCalled();
  expect(probe.queryByTestId('order-marker-image-1-svg')).toBeNull();
  await fireEvent(
    probe.getByTestId('order-marker-image-1-measure'),
    'textLayout',
    {nativeEvent: {lines: [{width: 120, height: 19}]}},
  );
  await fireEvent(probe.getByTestId('order-marker-image-1-svg'), 'layout');
  await act(async () => {
    mockCaptures[1].callback('latest');
  });
  expect(onImage).toHaveBeenCalledTimes(1);
  expect(onImage.mock.calls[0][0].source.uri).toContain('latest');
});

it('не отправляет PNG после удаления метки', async () => {
  const onImage = jest.fn();
  const probe = await render(<OrderMarkerImage {...base} onImage={onImage} />);
  await fireEvent(
    probe.getByTestId('order-marker-image-1-measure'),
    'textLayout',
    {nativeEvent: {lines: [{width: 100, height: 19}]}},
  );
  await fireEvent(probe.getByTestId('order-marker-image-1-svg'), 'layout');
  await probe.unmount();
  await act(async () => {
    mockCaptures[0].callback('late');
  });
  expect(onImage).not.toHaveBeenCalled();
});

it('сохраняет нативную метку при обновлении минут, координат, цвета и формы', async () => {
  const probe = await render(<ListOrders images={{1: bitmap}} />);
  mockLogic = {
    ...mockLogic,
    orders: [
      {
        ...baseItem,
        to_time_sec_min: 34,
        point_text: '15:49 (34 мин.)',
        point_color: 'red',
        close_time_: 1,
        xy: {lat: 53.3, lon: 50.2},
      },
    ],
  };
  await probe.rerender(<ListOrders images={{1: bitmap}} />);
  expect(mockMount).toHaveBeenCalledTimes(1);
  expect(mockUnmount).not.toHaveBeenCalled();
  expect(probe.getByTestId('order-marker-1').props.point).toEqual({
    lat: 53.3,
    lon: 50.2,
  });
});

it('обновляет обработчик и ограничивает нажатие на перекрывающихся метках', async () => {
  const oldPress = jest.fn(),
    newPress = jest.fn();
  const probe = await render(
    <OrderMarker {...base} image={bitmap} showOrdersMap={oldPress} />,
  );
  await probe.rerender(
    <OrderMarker
      {...base}
      image={bitmap}
      item={{...baseItem, id: 2}}
      showOrdersMap={newPress}
    />,
  );
  const marker = probe.getByTestId('order-marker-2');
  expect(marker.props.handled).toBe(true);
  expect(marker.props.strictTapBounds).toBe(true);
  fireEvent.press(marker);
  expect(newPress).toHaveBeenCalledWith(2);
  expect(oldPress).not.toHaveBeenCalled();
});

it('сохраняет размеры PNG с учётом плотности Android', () => {
  expect(getMarkerCaptureSize(348, 43, 'android', 3)).toEqual({
    width: 1044,
    height: 129,
  });
  expect(getMarkerCaptureSize(348, 43, 'ios', 3)).toEqual({
    width: 348,
    height: 43,
  });
});

it.each(
  (['classic', 'transparent', 'transparent_white', 'white', 'white_border', 'black'] as Theme[])
    .flatMap(theme => [0, 1].map(closeTime => [theme, closeTime] as const)),
)(
  'держит значок на адресе при изменении длины подписи: %s, pin=%s',
  async (theme, closeTime) => {
    const onImage = jest.fn();
    const item = {...baseItem, close_time_: closeTime};
    function Probe({text, fontSize}: {text: string; fontSize: number}) {
      const [image, setImage] = React.useState<MarkerBitmap | undefined>();
      const acceptImage = React.useCallback((next: MarkerBitmap) => {
        onImage(next);
        setImage(next);
      }, []);
      return <>
        <OrderMarkerImage {...base} item={{...item, point_text: text}} theme={theme} globalFontSize={fontSize} onImage={acceptImage} />
        <OrderMarker {...base} item={item} image={image} mapScale={1.8} />
      </>;
    }
    const probe = await render(<Probe text={baseItem.point_text} fontSize={16} />);

    for (const [text, textWidth, fontSize, textHeight] of [
      ['18:56 (85 мин.)', 100, 16, 19],
      ['20:00 - 20:30 (94 мин.)', 320, 28, 33],
    ] as const) {
      await probe.rerender(<Probe text={text} fontSize={fontSize} />);
      await fireEvent(probe.getByTestId('order-marker-image-1-measure'), 'textLayout', {
        nativeEvent: {lines: [{width: textWidth, height: textHeight, ascender: fontSize}]},
      });
      await fireEvent(probe.getByTestId('order-marker-image-1-svg'), 'layout');
      await act(async () => {mockCaptures[mockCaptures.length - 1].callback('bitmap');});
      const image: MarkerBitmap = onImage.mock.calls[onImage.mock.calls.length - 1][0];
      const marker = probe.getByTestId('order-marker-1');
      const iconHeight = theme === 'classic' ? 28 : 20;
      const pin = theme === 'classic' || Boolean(closeTime);
      const iconX = theme === 'classic' ? 20 * 75.66 / 183 : 10;
      const iconY = theme === 'classic' ? 28 * 283.39 / 285 : (pin ? iconHeight : iconHeight / 2);
      expect(marker.props.point).toEqual(baseItem.xy);
      // The address must coincide with the icon, regardless of the label box or scale.
      expect(marker.props.anchor.x * image.width).toBeCloseTo(iconX);
      expect(marker.props.anchor.y * image.height).toBeCloseTo((image.height - iconHeight) / 2 + iconY);
    }
  },
);


it('при смене темы до первого layout использует актуальную палитру и исходное измерение того же текста', async () => {
  const onImage = jest.fn(); const probe = await render(<OrderMarkerImage {...base} onImage={onImage} />);
  const measure = probe.getByTestId('order-marker-image-1-measure').props.onTextLayout;
  await probe.rerender(<OrderMarkerImage {...base} theme="black" onImage={onImage} />);
  await act(async () => {measure({nativeEvent: {lines: [{width: 100, height: 19, ascender: 15}]}})});
  await fireEvent(probe.getByTestId('order-marker-image-1-svg'), 'layout');
  await act(async () => {mockCaptures[0].callback('black')});
  expect(onImage.mock.calls[0][0].signature).toContain('black');
});
