import type {Order} from '@/shared/store/OrdersStoreType';
import {
  centerMapOnIndicator,
  getMapEdgeIndicators,
  groupOrdersByMapLocation,
  type MapViewport,
} from '@/features/orders-map/model/mapEdgeIndicators';

function order(id: number, lat: number, lon: number, color = '#CC0033'): Order {
  return {
    id,
    xy: {lat, lon},
    point_color: color,
  } as Order;
}

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

describe('индикаторы заказов за пределами карты', () => {
  it('не показывает заказы внутри видимой области', () => {
    expect(getMapEdgeIndicators([order(1, 53.5, 50.5)], viewport)).toEqual([]);
  });

  it('объединяет близкие заказы и направления', () => {
    const orders = [
      order(1, 55, 50, '#CC0033'),
      order(2, 55.000001, 50.000001, '#42627D'),
      order(3, 56, 50, '#CC0033'),
    ];

    expect(groupOrdersByMapLocation(orders)).toHaveLength(2);
    expect(getMapEdgeIndicators(orders, viewport)).toEqual([
      expect.objectContaining({
        sector: 0,
        angle: 0,
        count: 3,
        statusColors: ['#CC0033', '#42627D', '#CC0033'],
      }),
    ]);
  });

  it('сохраняет отдельный цвет для каждого заказа в группе', () => {
    const sameColor = [
      order(1, 55, 50, '#CC0033'),
      order(2, 55.000001, 50.000001, '#CC0033'),
      order(3, 55.000002, 50.000002, '#42627D'),
    ];

    expect(groupOrdersByMapLocation(sameColor)[0].statusColors).toEqual([
      '#CC0033',
      '#CC0033',
      '#42627D',
    ]);
  });

  it('использует самый срочный заказ для подписи групповой метки', () => {
    const later = {...order(1, 55, 50), to_time_sec_min: 45};
    const urgent = {...order(2, 55.000001, 50.000001), to_time_sec_min: 20};

    expect(groupOrdersByMapLocation([later, urgent])[0].representative.id).toBe(
      2,
    );
  });

  it('для заказов других курьеров использует цвет курьера, а не статуса', () => {
    const orders = [
      {
        ...order(1, 55, 50, '#b5e737'),
        color: '#a9203e',
      },
    ];

    expect(groupOrdersByMapLocation(orders, true)[0].statusColors).toEqual([
      '#a9203e',
    ]);
    expect(
      getMapEdgeIndicators(orders, viewport, true)[0].statusColors,
    ).toEqual(['#a9203e']);
  });

  it('учитывает поворот карты при выборе направления', () => {
    const [indicator] = getMapEdgeIndicators([order(1, 55, 50)], {
      ...viewport,
      azimuth: 90,
    });

    expect(indicator).toEqual(expect.objectContaining({sector: 6, angle: 270}));
  });

  it('пропускает заказы с некорректными координатами', () => {
    expect(getMapEdgeIndicators([order(1, Number.NaN, 50)], viewport)).toEqual(
      [],
    );
  });

  it('центрирует карту на заказе с текущими масштабом и поворотом', () => {
    const setCenter = jest.fn();
    const map = {
      getCameraPosition: jest.fn(callback =>
        callback({
          point: viewport.center,
          zoom: 14,
          azimuth: 35,
          tilt: 10,
          finished: true,
          reason: 'APPLICATION',
        }),
      ),
      setCenter,
    };

    centerMapOnIndicator(map, {lat: 55, lon: 52}, 0);

    expect(setCenter).toHaveBeenCalledWith(
      {lat: 55, lon: 52},
      14,
      35,
      10,
      0.4,
      0,
    );
  });
});
