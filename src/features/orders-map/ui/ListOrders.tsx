import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {OrderMarker, OrderMarkerImage} from './OrderMarker';
import type {MarkerBitmap} from './MeasuredMarkerImage';
import {useListOrdersLogic} from '../model/useListOrdersLogic';
import {isValidMapPoint} from '../model/mapPoint';
import {groupOrdersByMapLocation} from '../model/mapEdgeIndicators';

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
  const {orders, preferDriverColor} = logic;
  const groups = useMemo(
    () => groupOrdersByMapLocation(orders, preferDriverColor),
    [orders, preferDriverColor],
  );
  useEffect(() => {
    const ids = new Set(groups.map(group => group.representative.id));
    setImages(current => {
      const entries = Object.entries(current).filter(([id]) =>
        ids.has(Number(id)),
      );
      return entries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(entries);
    });
  }, [groups, setImages]);
  return (
    <>
      {groups.map(group => {
        const item = group.representative;
        return (
          <ImageForOrder
            key={item.id}
            {...logic}
            item={item}
            groupCount={group.count}
            statusColors={group.statusColors}
            onImage={onImage}
          />
        );
      })}
    </>
  );
}

export const ListOrders = memo(function ListOrders({
  images = {},
}: {
  images?: OrderMarkerImages;
}) {
  const logic = useListOrdersLogic();
  const groups = useMemo(
    () =>
      groupOrdersByMapLocation(
        logic.orders.filter(item => isValidMapPoint(item.xy)),
        logic.preferDriverColor,
      ),
    [logic.orders, logic.preferDriverColor],
  );
  return (
    <>
      {groups.map(group => {
        const item = group.representative;
        return (
          <OrderMarker
            key={item.id}
            {...logic}
            item={item}
            groupCount={group.count}
            statusColors={group.statusColors}
            image={images[item.id]}
          />
        );
      })}
    </>
  );
});
