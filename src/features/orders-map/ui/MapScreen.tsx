import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import YaMap, {Animation} from 'react-native-yamap-plus';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faLocationDot,
  faLocationPin,
  faLocationPinLock,
  faLockOpen,
  faLock,
  faRoad,
} from '@fortawesome/free-solid-svg-icons';

import {
  Slider,
  SliderThumb,
  SliderTrack,
  SliderFilledTrack,
} from '@/components/ui/slider';

import {TypeLimit} from './Limit';
import {ListOrders} from './ListOrders';
import {HomeMarker} from './HomeMarker';
import {ModalOrder} from './ModalOrder';
import {
  DriverMarker,
  DriverMarkerImage,
  type DriverMarkerImageSource,
} from './DriverMarker';
import {ModalFilterOrders} from './ModalFilterOrders';
import {OrdersMapCompass} from './OrdersMapCompass';

const {width, height} = Dimensions.get('window');
const MAP_CONTROL_RIGHT = 20;

import {useMapLogic} from '../model/useMapLogic';
import {isValidMapPoint} from '../model/mapPoint';
import {
  centerMapOnIndicator,
  type MapViewport,
  type OrderMapGroup,
} from '../model/mapEdgeIndicators';

import {Center} from '@/components/ui/center';
import {Spinner} from '@/components/ui/spinner';
import {useAppTheme} from '@/shared/theme/AppThemeProvider';

export function MapScreen() {
  const {colors, isDark} = useAppTheme();
  const {
    mapRef,
    zoom,
    updateZoom,
    getHome,
    home,
    set_type_location,
    type_location,
    driver_location_requesting,
    is_scaleMap,
    rotate_map,
    setRotateMap,
    is_showModalTypeDop,
    isOpenOrderMap,
    trafficVisible,
    isOffline,
    toggleTrafficVisible,
    mapInitStatus,
    mapInstanceKey,
    handleMapLoaded,
    retryMap,
    shouldRenderMap,
  } = useMapLogic();
  const [hasViewport, setHasViewport] = useState(false);
  const [driverMarkerImage, setDriverMarkerImage] =
    useState<DriverMarkerImageSource | null>(null);
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
  const viewportRequestRef = useRef(0);
  const validHome = isValidMapPoint(home) ? home : null;

  const updateMapViewport = useCallback(() => {
    const map = mapRef.current;
    const requestId = viewportRequestRef.current + 1;
    viewportRequestRef.current = requestId;

    if (!map) {
      setMapViewport(null);
      return;
    }

    map.getCameraPosition(camera => {
      if (requestId !== viewportRequestRef.current) return;

      map.getVisibleRegion(region => {
        if (requestId !== viewportRequestRef.current) return;
        setMapViewport({center: camera.point, azimuth: camera.azimuth, region});
      });
    });
  }, [mapRef]);

  const handleLoadedMap = useCallback(() => {
    handleMapLoaded();
    updateMapViewport();
  }, [handleMapLoaded, updateMapViewport]);

  const centerOnIndicator = useCallback(
    (target: OrderMapGroup) => {
      if (!mapRef.current) return;
      centerMapOnIndicator(mapRef.current, target.coordinate, Animation.SMOOTH);
    },
    [mapRef],
  );

  useEffect(() => {
    if (shouldRenderMap && hasViewport) return;
    viewportRequestRef.current += 1;
    setMapViewport(null);
  }, [hasViewport, shouldRenderMap]);

  useEffect(() => {
    viewportRequestRef.current += 1;
    setMapViewport(null);
  }, [mapInstanceKey]);

  const mtop = (height - 300) / 4;

  return (
    <View
      style={[styles1.root, {backgroundColor: colors.surface}]}
      testID="orders-map-screen">
      {!(is_showModalTypeDop || isOpenOrderMap) && is_scaleMap == 1 && (
        <Slider
          value={zoom}
          onChange={v => updateZoom(v)}
          size="lg"
          orientation="vertical"
          minValue={10}
          maxValue={20}
          step={0.2}
          style={{
            position: 'absolute',
            right: MAP_CONTROL_RIGHT,
            width: 50,
            height: 300,
            top: mtop,
            zIndex: 200,
          }}>
          <SliderTrack>
            <SliderFilledTrack />
          </SliderTrack>
          <SliderThumb />
        </Slider>
      )}

      <DriverMarkerImage onImage={setDriverMarkerImage} />

      <TouchableOpacity
        accessibilityLabel={
          rotate_map
            ? 'Заблокировать поворот карты'
            : 'Разблокировать поворот карты'
        }
        accessibilityRole="button"
        style={{
          backgroundColor: 'transparent',
          position: 'absolute',
          left: 10,
          top: 10,
          zIndex: 22,
          padding: 10,
        }}
        testID="orders-map-rotation-lock"
        onPress={() => setRotateMap(!rotate_map)}>
        <FontAwesomeIcon
          size={25}
          color={colors.text}
          style={{zIndex: 22}}
          icon={rotate_map === true ? faLockOpen : faLock}
        />
      </TouchableOpacity>

      {/* Геолокацию показываем только при наличии интернета. */}
      {!isOffline ? (
        <TouchableOpacity
          accessibilityLabel={
            type_location === 'none'
              ? 'Показать мою геопозицию'
              : type_location === 'location'
                ? 'Включить постоянное отслеживание геопозиции'
                : 'Выключить отслеживание геопозиции'
          }
          accessibilityRole="button"
          style={{
            backgroundColor: 'transparent',
            position: 'absolute',
            right: MAP_CONTROL_RIGHT,
            top: 10,
            padding: 10,
            zIndex: 22,
          }}
          testID="orders-map-driver-location"
          onPress={set_type_location}
          disabled={driver_location_requesting}>
          <FontAwesomeIcon
            size={25}
            color={colors.text}
            style={{zIndex: 22}}
            icon={
              type_location === 'location'
                ? faLocationDot
                : type_location === 'watch'
                  ? faLocationPin
                  : faLocationPinLock
            }
            testID="orders-map-driver-location-icon"
          />
        </TouchableOpacity>
      ) : null}

      {/* Пробки требуют сети. */}
      {!isOffline ? (
        <TouchableOpacity
          style={{
            backgroundColor: 'transparent',
            position: 'absolute',
            right: MAP_CONTROL_RIGHT,
            top: 60,
            padding: 10,
            zIndex: 22,
          }}
          onPress={() => toggleTrafficVisible()}
          accessibilityRole="button"
          accessibilityLabel={
            trafficVisible
              ? 'Скрыть пробки на карте'
              : 'Показать пробки на карте'
          }
          testID="orders-map-traffic">
          <FontAwesomeIcon
            size={25}
            color={trafficVisible ? '#22c55e' : colors.text}
            style={{zIndex: 22}}
            icon={faRoad}
          />
        </TouchableOpacity>
      ) : null}

      {/* Яндекс-карта */}
      <View
        style={styles1.ymap}
        collapsable={false}
        testID="orders-map-viewport"
        onLayout={event => {
          const {width, height} = event.nativeEvent.layout;
          setHasViewport(width > 1 && height > 1);
        }}>
        {shouldRenderMap && hasViewport ? (
          <YaMap
            key={mapInstanceKey}
            showUserPosition={false}
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            rotateGesturesDisabled={!rotate_map}
            nightMode={isDark}
            initialRegion={
              validHome
                ? {lat: validHome.lat, lon: validHome.lon, zoom: 12}
                : undefined
            }
            onMapLoaded={handleLoadedMap}
            onCameraPositionChangeEnd={updateMapViewport}
            collapsable={false}>
            {validHome && <HomeMarker point={validHome} getHome={getHome} isDark={isDark} />}
            <DriverMarker image={driverMarkerImage} />
            <ListOrders />
          </YaMap>
        ) : (
          <Center className="w-full h-full">
            {mapInitStatus === 'error' ? (
              <TouchableOpacity onPress={retryMap} style={{padding: 12}}>
                <Text style={{fontSize: 16, color: colors.text}}>
                  Карта не загрузилась. Нажмите, чтобы повторить
                </Text>
              </TouchableOpacity>
            ) : (
              <Spinner size={'large'} />
            )}
          </Center>
        )}
      </View>

      <OrdersMapCompass viewport={mapViewport} onCenter={centerOnIndicator} />

      <TypeLimit />
      <ModalOrder />
      <ModalFilterOrders />
    </View>
  );
}

export const styles1 = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  ymap: {
    flex: 1,
    width: width,
    height: height,
  },
});
