import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, PanResponder, TouchableOpacity } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';

import { VStack } from "@/components/ui/vstack"
import { Icon, CloseIcon } from "@/components/ui/icon"

import { useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import { animated, useSpring } from '@react-spring/native';

const AnimatedView = animated(View);

export const ConnectivityLocationIndicator: React.FC = () => {

  const [ globalFontSize ] = useGlobalStore(useShallow( state => [ state.globalFontSize ]));

  const [ is_show, setIsShow ] = useState<boolean>(false);

  // Состояние геолокации
  const [isLocationEnabled, setIsLocationEnabled] = useState<boolean>(true);
  // Состояние интернет соединения
  const [isInternetConnected, setIsInternetConnected] = useState<boolean>(true);
  // Плохое качество соединения (например, 2G)
  const [isPoorConnection, setIsPoorConnection] = useState<boolean>(false);
  // Информация о качестве соединения (например, '2G', 'WiFi')
  const [connectionQuality, setConnectionQuality] = useState<string | null>(null);

  useEffect(() => {
    // Проверка состояния геолокации
    const checkLocationEnabled = async () => {
      try {

        const enabled = await DeviceInfo.isLocationEnabled();
        setIsLocationEnabled(enabled);
      } catch (error) {
        // В случае ошибки можно считать, что геолокация включена,
        // либо установить значение по умолчанию false
        setIsLocationEnabled(true);
      }
    };

    checkLocationEnabled();

    // Подписка на изменения состояния сети
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? false;
      setIsInternetConnected(connected);

      // Если интернет отсутствует, сбрасываем проверку качества
      if (!connected) {
        setIsPoorConnection(false);
        setConnectionQuality(null);
        return;
      }

      // Если устройство подключено, проверяем тип соединения
      if (state.type === 'cellular') {
        const generation = state.details?.cellularGeneration;
        if (generation === '2g') {
          setIsPoorConnection(true);
          setConnectionQuality('2G');
        } else {
          setIsPoorConnection(false);
          setConnectionQuality(generation ? generation.toUpperCase() : null);
        }
      } else if (state.type === 'wifi') {
        setIsPoorConnection(false);
        setConnectionQuality('WiFi');
      } else {
        setIsPoorConnection(false);
        setConnectionQuality(state.type);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Если все условия удовлетворительные — ничего не отображаем
  if (!isLocationEnabled || !isInternetConnected || isPoorConnection) {
    return null;
  }

  if (isLocationEnabled && isInternetConnected && isPoorConnection) {
    setIsShow(true)
  }

  const styles = useSpring({
    from: { translateY: -200, opacity: 0 },
    to: { translateY: is_show ? 70 : -100, opacity: 1 },
    config: { tension: 200, friction: 20 },
  });

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy < -20) {
        setIsShow(false)
      }
    },
  });

  return (
    <AnimatedView
      {...panResponder.panHandlers}
      style={[
        {
          transform: [{ translateY: styles.translateY }],
          opacity: styles.opacity,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          borderRadius: 4,
          zIndex: 50
        },
      ]}
    >
      <VStack className="gap-4 flex-row justify-between pl-5 pr-5 pt-3 pb-3 rounded-lg flex-1 items-center w-auto mr-5 ml-5" style={{ backgroundColor: "#44944a" }}>
        
        { !isInternetConnected && (
          <Text className="font-semibold text-white w-11/12" style={{ fontSize: globalFontSize }}>Нет интернет соединения</Text>
        )}
        { !isLocationEnabled && (
          <Text className="font-semibold text-white w-11/12" style={{ fontSize: globalFontSize }}>Геолокация отключена</Text>
        )}
        { isPoorConnection && (
          <Text className="font-semibold text-white w-11/12" style={{ fontSize: globalFontSize }}>
            Плохое качество соединения {connectionQuality && `(${connectionQuality})`}
          </Text>
        )}

        <TouchableOpacity onPress={() => { setIsShow(false) }} className="w-1/12">
          <Icon color="white" as={CloseIcon} />
        </TouchableOpacity>
      </VStack>
    </AnimatedView>
  );




  // return (
  //   <View style={styles.container}>
  //     <Text style={styles.text}>Нет интернет соединения</Text>
  //     { !isInternetConnected && (
  //       <Text style={styles.text}>Нет интернет соединения</Text>
  //     )}
  //     { !isLocationEnabled && (
  //       <Text style={styles.text}>Геолокация отключена</Text>
  //     )}
  //     { isPoorConnection && (
  //       <Text style={styles.text}>
  //         Плохое качество соединения {connectionQuality && `(${connectionQuality})`}
  //       </Text>
  //     )}
  //   </View>
  // );
};

const styles11 = StyleSheet.create({
  container: {
    backgroundColor: 'red',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: StatusBar.currentHeight || 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
  },
});