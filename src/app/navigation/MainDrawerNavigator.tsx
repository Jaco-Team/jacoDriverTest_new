import React, { useEffect } from 'react'
import { Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGlobalStore, useOrdersStore, useGEOStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import {
  createDrawerNavigator,
  useDrawerStatus,
} from '@react-navigation/drawer';
import type { DrawerContentComponentProps } from '@react-navigation/drawer'

import { SettingsScreen } from '@/features/settings/ui/SettingsScreen';
import { PriceScreen } from '@/features/salary/ui/PriceScreen';
import { AuthScreen } from '@/features/auth/ui/AuthScreen';
import { ResetPwdScreen } from '@/features/reset-pwd/ui/ResetPwdScreen';
import { OrdersListScreen } from '@/features/orders-list/ui/OrdersListScreen';
import { MapScreen } from '@/features/orders-map/ui/MapScreen';
import { GraphScreen } from '@/features/schedule/ui/GraphScreen';
import { StatisticsTableScreen } from '@/features/statistics/ui/StatisticsTableScreen';
import { Greeting } from '@/app/screens/Greeting';
import { FeedbackScreen } from '@/features/feedback/ui/FeedbackScreen';

import { CustomDrawerContent } from './CustomDrawerContent';

import { RefreshCcw } from 'lucide-react-native';
import { SystemBars } from 'react-native-edge-to-edge'

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faBars, faFilter } from '@fortawesome/free-solid-svg-icons'
import { HStack } from '@/components/ui/hstack';

import { useAvgTimeUpdater } from '@/shared/lib/useAvgTimeUpdater'
import { useSettingsUpdater } from '@/shared/lib/useSettingsUpdater'
import { useUserLocationUpdater } from '@/shared/lib/useUserLocationUpdater'
import { initializeNotifications, requestNotificationPermission } from '@/shared/lib/notifications'
import { appPalette } from '@/shared/styles/appPalette'

const Drawer = createDrawerNavigator();

function EdgeToEdgeDrawerContent(
  props: DrawerContentComponentProps,
): React.JSX.Element {
  const drawerStatus = useDrawerStatus()

  return (
    <>
      {Platform.OS === 'android' ? (
        <SystemBars hidden={{ statusBar: drawerStatus === 'open' }} />
      ) : null}
      <CustomDrawerContent {...props} />
    </>
  )
}

export function MainDrawerNavigator() {
  const insets = useSafeAreaInsets()
  const [ globalFontSize, is_need_avg_time, is_need_page_stat, setNotifToken ] = useGlobalStore(useShallow( state => [ state.globalFontSize, state.is_need_avg_time, state.is_need_page_stat, state.setNotifToken ]));
  
  const [ getOrders, types_dop, type_dop, showModalTypeDop ] = useOrdersStore(useShallow(state => [ state.getOrders, state.types_dop, state.type_dop, state.showModalTypeDop ]));

  const [ checkMyPos ] = useGEOStore(useShallow(state => [ state.checkMyPos ]));

  useAvgTimeUpdater(is_need_avg_time);
  useUserLocationUpdater(checkMyPos);
  useSettingsUpdater();

  useEffect(() => {
    //Инициализация уведомлений и получение токена
    initializeNotifications(setNotifToken)
    requestNotificationPermission()
  }, [setNotifToken])

  // добавлял при настройке jest, но пока не используется
  // useEffect(() => {
  //   let unsub: undefined | (() => void);
  //   let mounted = true;

  //   (async () => {
  //     const cleanup = await initializeNotifications(setNotifToken);
  //     if (mounted) {
  //       unsub = cleanup;
  //       await requestNotificationPermission();
  //     } else {
  //       cleanup(); // если уже размонтировались — сразу почистим
  //     }
  //   })();

  //   return () => {
  //     mounted = false;
  //     unsub?.();
  //   };
  // }, [setNotifToken]);

  const isActiveFilter = types_dop.length != type_dop.length;

  return (
    <Drawer.Navigator
      initialRouteName={"Greeting"}
      screenOptions={({ navigation }) => {
        return {
          drawerActiveTintColor: appPalette.primary,
          drawerInactiveTintColor: appPalette.text,
          drawerStyle: {
            width: '86%',
            maxWidth: 340,
            backgroundColor: '#F6F9FC',
          },
          drawerType: 'front',
          ...(Platform.OS === 'ios'
            ? {
                drawerHideStatusBarOnOpen: true,
                drawerStatusBarAnimation: 'fade' as const,
              }
            : {}),
          overlayStyle: {
            backgroundColor: 'rgba(17, 27, 36, 0.42)',
          },
          headerStyle: {
            backgroundColor: '#c03',
            ...(Platform.OS === 'ios' ? { height: insets.top + 56 } : {}),
          },
          ...(Platform.OS === 'ios'
            ? { headerStatusBarHeight: insets.top }
            : {}),
          headerTintColor: '#fff',
          headerTitleAlign: 'left',
          headerTitleStyle: {
            color: '#fff',
            fontSize: globalFontSize,
          },
          headerLeft: () => (
            <TouchableOpacity
              accessibilityLabel="Открыть меню"
              accessibilityRole="button"
              hitSlop={8}
              style={{
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => navigation.openDrawer()}
            >
              <FontAwesomeIcon size={23} color="#fff" icon={faBars} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <HStack>
              <TouchableOpacity
                style={{ marginRight: 30 }}
                onPress={() => showModalTypeDop(true)}
              >
                <FontAwesomeIcon
                  size={25}
                  color={isActiveFilter ? '#fff44f' : '#fff'}
                  icon={faFilter}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ marginRight: 16 }}
                onPress={() => getOrders(true)}
              >
                <RefreshCcw size={25} color="#fff" />
              </TouchableOpacity>
            </HStack>
          ),
        }
      }}
      drawerContent={props => <EdgeToEdgeDrawerContent {...props} />}
    >
      <Drawer.Screen
        name="Greeting"
        component={Greeting}
        
        options={{
          drawerLabel: 'Приветствие',
          headerShown: false,
          drawerItemStyle: {height: 0},
          swipeEnabled: false,
          drawerLabelStyle: { fontSize: globalFontSize },
          headerRight: () => null,
        }}
      />

      <Drawer.Screen
        name="Auth"
        component={AuthScreen}
        
        options={{
          drawerLabel: 'Авторизация',
          headerShown: false,
          drawerItemStyle: {height: 0},
          swipeEnabled: false,
          drawerLabelStyle: { fontSize: globalFontSize },
          headerRight: () => null,
        }}
      />
      <Drawer.Screen
        name="ResetPwd"
        component={ResetPwdScreen}
        options={{
          drawerLabel: 'Восстановление пароля',
          headerShown: false,
          drawerItemStyle: {height: 0},
          swipeEnabled: false,
          drawerLabelStyle: { fontSize: globalFontSize },
          headerRight: () => null,
        }}
      />

      <Drawer.Screen
        name="List_orders"
        component={OrdersListScreen}
        
        options={{
          drawerLabel: 'Список заказов',
          title: 'Список заказов',
          headerShown: true,
          swipeEnabled: true,
          drawerItemStyle: {backgroundColor: '#fff'},
          drawerLabelStyle: { fontSize: globalFontSize },
          
        }}
      />

      <Drawer.Screen
        name="Map"
        component={MapScreen}
        options={{
          drawerLabel: 'Карта заказов',
          title: 'Карта заказов',
          headerShown: true,
          swipeEnabled: true,
          freezeOnBlur: false,
          drawerItemStyle: {backgroundColor: '#fff'},
          drawerLabelStyle: { fontSize: globalFontSize },
        }}
      />





      <Drawer.Screen
        name="Price"
        component={PriceScreen}
        options={{
          drawerLabel: 'Расчет',
          title: 'Расчет',
          headerShown: true,
          drawerItemStyle: {backgroundColor: '#fff'},
          swipeEnabled: true,
          drawerLabelStyle: { fontSize: globalFontSize },
          headerRight: () => null,
        }}
      />
      <Drawer.Screen
        name="Graph"
        component={GraphScreen}
        options={{
          drawerLabel: 'График работы',
          title: 'График работы',
          headerShown: true,
          swipeEnabled: true,
          drawerItemStyle: {backgroundColor: '#fff'},
          drawerLabelStyle: { fontSize: globalFontSize },
          headerRight: () => null,
        }}
      />
      <Drawer.Screen
        name="Statistics"
        component={StatisticsTableScreen}
        options={{
          drawerLabel: 'Статистика времени',
          title: 'Статистика времени',
          headerShown: true,
          swipeEnabled: true,
          drawerItemStyle: is_need_page_stat ? {backgroundColor: '#fff'} : {backgroundColor: '#fff', height: 0},
          drawerLabelStyle: { fontSize: globalFontSize },
          headerRight: () => null,
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          drawerLabel: 'Настройки',
          title: 'Настройки',
          headerShown: true,
          swipeEnabled: true,
          drawerItemStyle: {backgroundColor: '#fff'},
          drawerLabelStyle: { fontSize: globalFontSize },
          headerRight: () => null,
        }}
      />
      <Drawer.Screen
        name="FeedbackScreen"
        component={FeedbackScreen}
        options={{
          drawerLabel: 'Предложения',
          title: 'Предложения',
          headerShown: true,
          swipeEnabled: true,
          drawerItemStyle: {backgroundColor: '#fff'},
          drawerLabelStyle: { fontSize: globalFontSize },
          headerRight: () => null,
        }}
      />
    </Drawer.Navigator>
  )
}
