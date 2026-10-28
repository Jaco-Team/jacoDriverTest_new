import React, { useEffect } from 'react'
import { Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';
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
import { OrdersUiPreviewScreen } from '@/app/screens/OrdersUiPreviewScreen'
import { useOrderRecommendationStore } from '@/features/order-recommendation/model/orderRecommendation.store'

import { CustomDrawerContent } from './CustomDrawerContent';

import { RefreshCcw } from 'lucide-react-native';
import { SystemBars } from 'react-native-edge-to-edge'

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faBars, faFilter } from '@fortawesome/free-solid-svg-icons'
import { HStack } from '@/components/ui/hstack';

import { useAvgTimeUpdater } from '@/shared/lib/useAvgTimeUpdater'
import { useSettingsUpdater } from '@/shared/lib/useSettingsUpdater'
import { useUserLocationUpdater } from '@/shared/lib/useUserLocationUpdater'
import { useOrdersBackgroundUpdater } from '@/shared/lib/useOrdersBackgroundUpdater'
import { initializeNotifications, requestNotificationPermission } from '@/shared/lib/notifications'
import { ConnectivityLocationIndicator } from '@/shared/ui/ConnectivityLocationIndicator'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'
import {useCodePushDebug} from '@/features/codepush-debug/ui/CodePushDebugProvider'

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
  const { colors } = useAppTheme()
  const {open: openCodePushDebug} = useCodePushDebug()
  const [ globalFontSize, is_need_avg_time, is_need_page_stat, setNotifToken ] = useGlobalStore(useShallow( state => [ state.globalFontSize, state.is_need_avg_time, state.is_need_page_stat, state.setNotifToken ]));
  
  const [
    getOrders,
    types_dop,
    type_dop,
    showModalTypeDop,
    prefetchOrders,
    ordersContextKey,
    hasCurrentOrdersCache,
    ordersPrefetchPaused,
    isCheckingOrders,
    orderTypeId,
  ] = useOrdersStore(useShallow(state => [
    state.getOrders,
    state.types_dop,
    state.type_dop,
    state.showModalTypeDop,
    state.prefetchOrders,
    state.ordersContextKey,
    state.ordersCache?.[state.ordersContextKey ?? ''] !== undefined,
    state.ordersPrefetchPaused ?? false,
    state.is_check ?? false,
    state.type.id,
  ]));

  const [ checkMyPos ] = useGEOStore(useShallow(state => [ state.checkMyPos ]));

  useAvgTimeUpdater(is_need_avg_time);
  useUserLocationUpdater(checkMyPos);
  useSettingsUpdater();
  useOrdersBackgroundUpdater(
    prefetchOrders,
    ordersContextKey,
    hasCurrentOrdersCache,
    ordersPrefetchPaused,
    isCheckingOrders,
  );

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
  const isRecommendationActive = useOrderRecommendationStore(state => state.isLoading || state.result !== null)

  return (
    <Drawer.Navigator
      initialRouteName={"Greeting"}
      backBehavior="history"
      screenOptions={({ navigation }) => {
        return {
          drawerActiveTintColor: colors.primary,
          drawerInactiveTintColor: colors.text,
          drawerStyle: {
            width: '86%',
            maxWidth: 340,
            backgroundColor: colors.surface,
          },
          drawerType: 'front',
          ...(Platform.OS === 'ios'
            ? {
                drawerHideStatusBarOnOpen: true,
                drawerStatusBarAnimation: 'fade' as const,
              }
            : {}),
          overlayStyle: {
            backgroundColor: colors.overlay,
          },
          headerStyle: {
            backgroundColor: colors.brandHeader,
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
          header: ({ options, route }) => (
            <View>
              <View
                style={{
                  minHeight: insets.top + 56,
                  paddingTop: insets.top,
                  backgroundColor: colors.brandHeader,
                }}
                testID="main-drawer-header"
              >
                <View
                  style={{
                    height: 56,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  {options.headerLeft?.({
                    canGoBack: false,
                    tintColor: '#fff',
                  })}
                  <Pressable
                    accessible={false}
                    delayLongPress={3000}
                    onLongPress={openCodePushDebug}
                    testID="header-diagnostics-trigger"
                    style={{
                      flex: 1,
                      alignSelf: 'stretch',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: '#fff',
                        fontSize: globalFontSize,
                        fontWeight: '600',
                      }}
                    >
                      {options.title ?? route.name}
                    </Text>
                  </Pressable>
                  {options.headerRight?.({
                    canGoBack: false,
                    tintColor: '#fff',
                  })}
                </View>
              </View>
              {route.name !== 'Map' ? <ConnectivityLocationIndicator /> : null}
            </View>
          ),
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
            <HStack style={{ alignItems: 'center' }}>
              {orderTypeId === 1 && !isRecommendationActive ? (
                <TouchableOpacity
                  accessibilityLabel={isActiveFilter ? 'Фильтр статусов включён' : 'Фильтр статусов'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActiveFilter }}
                  testID="orders-status-filter"
                  style={{ marginRight: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => showModalTypeDop(true)}
                >
                  <View
                    testID="orders-status-filter-background"
                    style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isActiveFilter ? '#2196F3' : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <FontAwesomeIcon
                      size={25}
                      color="#fff"
                      icon={faFilter}
                    />
                  </View>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                accessibilityLabel="Обновить заказы"
                accessibilityRole="button"
                testID="orders-refresh"
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
          drawerItemStyle: {backgroundColor: colors.surfaceRaised},
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
          drawerItemStyle: {backgroundColor: colors.surfaceRaised},
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
          drawerItemStyle: {backgroundColor: colors.surfaceRaised},
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
          drawerItemStyle: {backgroundColor: colors.surfaceRaised},
          drawerLabelStyle: { fontSize: globalFontSize },
          headerRight: () => null,
        }}
      />
      <Drawer.Screen
        name="Statistics"
        component={StatisticsTableScreen}
        options={{
          drawerLabel: 'Статистика',
          title: 'Статистика',
          headerShown: true,
          swipeEnabled: true,
          drawerItemStyle: is_need_page_stat
            ? {backgroundColor: colors.surfaceRaised}
            : {backgroundColor: colors.surfaceRaised, height: 0},
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
          drawerItemStyle: {backgroundColor: colors.surfaceRaised},
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
          drawerItemStyle: {backgroundColor: colors.surfaceRaised},
          drawerLabelStyle: { fontSize: globalFontSize },
          headerRight: () => null,
        }}
      />
      {__DEV__ ? (
        <Drawer.Screen
          name="OrdersUiPreview"
          component={OrdersUiPreviewScreen}
          options={{
            drawerLabel: 'UI заказов (DEV)',
            title: 'UI заказов (DEV)',
            headerShown: true,
            swipeEnabled: true,
            drawerItemStyle: { backgroundColor: colors.surfaceRaised },
            drawerLabelStyle: { fontSize: globalFontSize },
            headerRight: () => null,
          }}
        />
      ) : null}
    </Drawer.Navigator>
  )
}
