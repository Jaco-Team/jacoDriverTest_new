import React, { memo } from 'react'

import { useGlobalStore, useLoginStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import { useDialCall } from '@/shared/lib/useDialCall';

import { useNavigation, ParamListBase } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';

import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';
import {RU_SCREEN_NAMES} from '@/app/navigation/types';

export const CustomDrawerContent = memo(function CustomDrawerContent(props: any): React.JSX.Element {
  const { navigate } = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const [ globalFontSize, phones, is_need_avg_time, avgTime ] = useGlobalStore(useShallow( state => [ state.globalFontSize, state.phones, state.is_need_avg_time, state.avgTime ]));
  
  const [ logogout ] = useLoginStore(useShallow( state => [ state.logogout ]));

  const dialCall = useDialCall();

  const logOut = async () => {
    const title = RU_SCREEN_NAMES['Auth'] ?? 'Авторизация';
    Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${title}`);

    logogout();
    navigate('Auth');
  };

  return (
    <DrawerContentScrollView {...props}>
    
      {is_need_avg_time &&
        <DrawerItem
          activeTintColor="#c03"
          inactiveTintColor="#000"
          label={"Ср. время: "+avgTime}
          onPress={ () => {} }
          labelStyle={{fontSize: globalFontSize }}
        />
      }

      <DrawerItemList {...props} />

      {phones?.phone_upr ?
        <DrawerItem
          activeTintColor="#c03"
          inactiveTintColor="#000"
          label="Директор"
          onPress={() => {
            Analytics.log(AnalyticsEvent.DrawerCallDirector, 'Звонок директору');
            dialCall(phones.phone_upr);
          }}
          labelStyle={{fontSize: globalFontSize }}
        />
          :
        false
      }

      {phones?.phone_man ? (
        <DrawerItem
          activeTintColor="#c03"
          inactiveTintColor="#000"
          label="Менеджер"
          onPress={() => {
            Analytics.log(AnalyticsEvent.DrawerCallManager, 'Звонок менеджеру');
            dialCall(phones.phone_man);
          }}
          labelStyle={{ fontSize: globalFontSize }}
        />
      ) : false}

       {phones?.phone_center ? (
        <DrawerItem
          activeTintColor="#c03"
          inactiveTintColor="#000"
          label="Контакт-центр"
          onPress={() => {
            Analytics.log(AnalyticsEvent.DrawerCallContactCenter, 'Звонок в Контакт-центр');
            dialCall(phones.phone_center);
          }}
          labelStyle={{ fontSize: globalFontSize }}
        />
      ) : false}

      <DrawerItem
        label="Выйти"
        activeTintColor="#c03"
        inactiveTintColor="#000"
        onPress={logOut}
        labelStyle={{fontSize: globalFontSize }}
      />
    </DrawerContentScrollView>
  );
})
