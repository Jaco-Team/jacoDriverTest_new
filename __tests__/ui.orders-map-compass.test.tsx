import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';

import {OrdersMapCompass} from '@/features/orders-map/ui/OrdersMapCompass';
import type {MapViewport} from '@/features/orders-map/model/mapEdgeIndicators';
import type {Order} from '@/shared/store/OrdersStoreType';
import {useOrdersStore} from '@/shared/store/store';

const viewport: MapViewport = {
  center: {lat: 53, lon: 50},
  azimuth: 0,
  region: {
    topLeft: {lat: 54, lon: 49},
    topRight: {lat: 54, lon: 51},
    bottomRight: {lat: 52, lon: 51},
    bottomLeft: {lat: 52, lon: 49},
  },
};

describe('компас заказов за пределами карты', () => {
  beforeEach(() => {
    useOrdersStore.setState({
      orders: [
        {
          id: 1,
          xy: {lat: 55, lon: 50},
          point_color: '#CC0033',
        } as Order,
      ],
    });
  });

  it('показывает количество и передаёт цель при нажатии', async () => {
    const onCenter = jest.fn();

    await render(<OrdersMapCompass viewport={viewport} onCenter={onCenter} />);

    const indicator = screen.getByLabelText(
      'Показать 1 заказ, направление север',
    );
    expect(indicator.props.accessibilityRole).toBe('button');
    expect(screen.getByTestId('orders-map-compass')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();

    fireEvent.press(indicator);

    expect(onCenter).toHaveBeenCalledWith(
      expect.objectContaining({coordinate: {lat: 55, lon: 50}, count: 1}),
    );
  });
});
