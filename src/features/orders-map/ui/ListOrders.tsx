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
  hiddenOrderIds = [],
}: Pick<ReturnType<typeof useOrderMarkerImages>, 'onImage' | 'setImages'> & {
  hiddenOrderIds?: number[];
}) {
  const logic = useListOrdersLogic();
  const {orders, preferDriverColor} = logic;
  const hiddenIds = useMemo(() => new Set(hiddenOrderIds), [hiddenOrderIds]);
  const visibleOrders = useMemo(
    () => orders.filter(order => !hiddenIds.has(order.id)),
    [hiddenIds, orders],
  );
  const groups = useMemo(
    () => groupOrdersByMapLocation(visibleOrders, preferDriverColor),
    [preferDriverColor, visibleOrders],
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
  hiddenOrderIds = [],
}: {
  images?: OrderMarkerImages;
  hiddenOrderIds?: number[];
}) {
  const logic = useListOrdersLogic();
  const hiddenIds = useMemo(() => new Set(hiddenOrderIds), [hiddenOrderIds]);
  const groups = useMemo(
    () =>
      groupOrdersByMapLocation(
        logic.orders.filter(
          item => isValidMapPoint(item.xy) && !hiddenIds.has(item.id),
        ),
        logic.preferDriverColor,
      ),
    [hiddenIds, logic.orders, logic.preferDriverColor],
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
