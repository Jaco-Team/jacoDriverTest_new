import React, {memo, useCallback, useEffect, useState} from 'react';
import {OrderMarker, OrderMarkerImage} from './OrderMarker';
import type {MarkerBitmap} from './MeasuredMarkerImage';
import {useListOrdersLogic} from '../model/useListOrdersLogic';
import {isValidMapPoint} from '../model/mapPoint';

export type OrderMarkerImages = Record<number, MarkerBitmap>;

export function useOrderMarkerImages() {
  const [images, setImages] = useState<OrderMarkerImages>({});
  const onImage = useCallback((id: number, image: MarkerBitmap) => {
    setImages(current =>
      current[id]?.signature === image.signature
        ? current
        : {...current, [id]: image},
    );
  }, []);
  return {images, onImage, setImages};
}

const ImageForOrder = memo(function ImageForOrder({
  onImage,
  ...props
}: React.ComponentProps<typeof OrderMarker> & {
  onImage: (id: number, image: MarkerBitmap) => void;
}) {
  const id = props.item.id;
  const acceptImage = useCallback(
    (image: MarkerBitmap) => onImage(id, image),
    [id, onImage],
  );
  return <OrderMarkerImage {...props} onImage={acceptImage} />;
});

export function OrderMarkerImageSources({
  onImage,
  setImages,
}: Pick<ReturnType<typeof useOrderMarkerImages>, 'onImage' | 'setImages'>) {
  const logic = useListOrdersLogic();
  const {orders} = logic;
  useEffect(() => {
    const ids = new Set(orders.map(order => order.id));
    setImages(current => {
      const entries = Object.entries(current).filter(([id]) =>
        ids.has(Number(id)),
      );
      return entries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(entries);
    });
  }, [orders, setImages]);
  return (
    <>
      {orders
        .filter(item => isValidMapPoint(item.xy))
        .map(item => (
          <ImageForOrder
            key={item.id}
            {...logic}
            item={item}
            onImage={onImage}
          />
        ))}
    </>
  );
}

export const ListOrders = memo(function ListOrders({
  images = {},
}: {
  images?: OrderMarkerImages;
}) {
  const logic = useListOrdersLogic();
  return (
    <>
      {logic.orders
        .filter(item => isValidMapPoint(item.xy))
        .map(item => (
          <OrderMarker
            key={item.id}
            {...logic}
            item={item}
            image={images[item.id]}
          />
        ))}
    </>
  );
});
