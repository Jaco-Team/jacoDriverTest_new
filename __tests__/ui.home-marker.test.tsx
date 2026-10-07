import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
const mockMount = jest.fn(); const mockUnmount = jest.fn();
jest.mock('react-native-yamap-plus', () => {
  const R = require('react'); const {View} = require('react-native');
  return {Marker: (props: any) => { R.useEffect(() => {mockMount();return mockUnmount;}, []);return R.createElement(View, props); }};
});
jest.mock('@/features/orders-map/ui/MeasuredMarkerImage', () => {
  const R = require('react'); const {View} = require('react-native');
  return {MeasuredMarkerImage: (props: any) => R.createElement(View, props)};
});
import {HomeMarker, HomeMarkerImage} from '@/features/orders-map/ui/HomeMarker';
const point = {lat: 53.2, lon: 50.1} as any;
const image = {signature: 'home:false', width: 20, height: 20, anchor: {x: 0.5, y: 0.5}, source: {uri: 'light'}};
beforeEach(() => {mockMount.mockClear();mockUnmount.mockClear();});

it.each([[false, '#000000'], [true, '#FFFFFF']] as const)('создаёт домик размером 20 без пустой подписи, dark=%s', async (isDark, color) => {
  const probe = await render(<HomeMarkerImage isDark={isDark} onImage={jest.fn()} />);
  const props = probe.getByTestId('orders-map-home-image').props;
  expect(props.icon).toMatchObject({width: 20, height: 20, color});
  expect(props.text).toBe('');
});

it('показывает единый сгенерированный домик и пересоздаёт его после смены сети', async () => {
  const getHome = jest.fn();
  const probe = await render(
    <HomeMarker
      point={point}
      getHome={getHome}
      isDark={false}
      image={image}
      refreshKey="online"
    />,
  );
  const initialMarker = probe.getByTestId('orders-map-home-marker');
  expect(initialMarker.props.visible).toBe(true);
  expect(initialMarker.props.scale).toBe(1);
  expect(initialMarker.props.source).toEqual(image.source);
  expect(initialMarker.props.anchor).toEqual({x: 0.5, y: 0.5});

  await probe.rerender(
    <HomeMarker
      point={{...point, lon: 50.2}}
      getHome={getHome}
      isDark={false}
      image={image}
      refreshKey="online"
    />,
  );
  const marker = probe.getByTestId('orders-map-home-marker');
  expect(mockMount).toHaveBeenCalledTimes(1);
  expect(mockUnmount).not.toHaveBeenCalled();
  expect(marker.props.source).toEqual(initialMarker.props.source); expect(marker.props.point.lon).toBe(50.2);
  expect(marker.props.visible).toBe(true);
  expect(marker.props.handled).toBe(true);expect(marker.props.strictTapBounds).toBe(true);
  expect(marker.props.anchor).toEqual({x: 0.5, y: 0.5});
  await fireEvent.press(marker);expect(getHome).toHaveBeenCalledTimes(1);

  await probe.rerender(
    <HomeMarker
      point={{...point, lon: 50.2}}
      getHome={getHome}
      isDark={false}
      image={image}
      refreshKey="offline"
    />,
  );
  expect(mockMount).toHaveBeenCalledTimes(2);
  expect(mockUnmount).toHaveBeenCalledTimes(1);
});

it('меняет сгенерированное изображение домика вместе с темой', async () => {
  const getHome = jest.fn();
  const probe = await render(
    <HomeMarker point={point} getHome={getHome} isDark={false} image={image} />,
  );
  const lightSource = probe.getByTestId('orders-map-home-marker').props.source;
  const darkImage = {
    ...image,
    signature: 'home:true',
    source: {uri: 'dark'},
  };

  await probe.rerender(
    <HomeMarker point={point} getHome={getHome} isDark image={darkImage} />,
  );
  const darkSource = probe.getByTestId('orders-map-home-marker').props.source;
  expect(darkSource).not.toEqual(lightSource);
  expect(darkSource).toEqual(darkImage.source);
  expect(mockMount).toHaveBeenCalledTimes(2);
  expect(mockUnmount).toHaveBeenCalledTimes(1);
});

it('не показывает домик от предыдущей темы до готовности нового изображения', async () => {
  const probe = await render(
    <HomeMarker point={point} getHome={jest.fn()} isDark image={image} />,
  );
  const marker = probe.getByTestId('orders-map-home-marker');
  expect(marker.props.visible).toBe(false);
  expect(marker.props.source).toBeUndefined();
});
