import React, { useEffect } from 'react'

import { useGlobalStore, useOrdersStore, useGEOStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import { createDrawerNavigator } from '@react-navigation/drawer';

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
import { TouchableOpacity } from 'react-native';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faFilter } from '@fortawesome/free-solid-svg-icons'
import { HStack } from '@/components/ui/hstack';

import { useAvgTimeUpdater } from '@/shared/lib/useAvgTimeUpdater'
import { useSettingsUpdater } from '@/shared/lib/useSettingsUpdater'
import { useUserLocationUpdater } from '@/shared/lib/useUserLocationUpdater'
import { initializeNotifications, requestNotificationPermission } from '@/shared/lib/notifications'

const Drawer = createDrawerNavigator();

export function MainDrawerNavigator() {
  const [ globalFontSize, is_need_avg_time, is_need_page_stat, setNotifToken ] = useGlobalStore(useShallow( state => [ state.globalFontSize, state.is_need_avg_time, state.is_need_page_stat, state.setNotifToken ]));
  
  const [ getOrders, types_dop, type_dop, showModalTypeDop ] = useOrdersStore(useShallow(state => [ state.getOrders, state.types_dop, state.type_dop, state.showModalTypeDop ]));

  const [ checkMyPos ] = useGEOStore(useShallow(state => [ state.checkMyPos ]));

  useAvgTimeUpdater(is_need_avg_time);
  useUserLocationUpdater(checkMyPos);
  useSettingsUpdater();

  useEffect(() => {
    // Инициализация уведомлений и получение токена
    initializeNotifications(setNotifToken)
    requestNotificationPermission()
  }, [setNotifToken])

  const isActiveFilter = types_dop.length != type_dop.length;

  return (
    <Drawer.Navigator
      initialRouteName={"Greeting"}
      
      screenOptions={{
        drawerActiveTintColor: '#c03',
        drawerInactiveTintColor: '#000',        
        
        headerStyle: {
          backgroundColor: '#c03',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          color: '#fff',
          fontSize: globalFontSize
        },
        headerRight: () => (
          <HStack>
            <TouchableOpacity style={{ marginRight: 30 }} onPress={ () => showModalTypeDop(true) }>
              <FontAwesomeIcon size={25} color={ isActiveFilter ? '#fff44f' : '#fff' } icon={faFilter} />
            </TouchableOpacity>
            <TouchableOpacity style={{ marginRight: 16 }} onPress={ () => getOrders(true) }>
              <RefreshCcw size={25} color="#fff" />
            </TouchableOpacity>
          </HStack>
        ),
      }}
      drawerContent={props => <CustomDrawerContent {...props} />}
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