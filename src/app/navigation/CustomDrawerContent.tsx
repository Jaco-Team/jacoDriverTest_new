import React, { memo } from 'react'

import { useGlobalStore, useLoginStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import { useDialCall } from '@/shared/lib/useDialCall';

import { useNavigation, ParamListBase } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';

export const CustomDrawerContent = memo(function CustomDrawerContent(props: any): React.JSX.Element {
  const { navigate } = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const [ globalFontSize, phones, is_need_avg_time, avgTime ] = useGlobalStore(useShallow( state => [ state.globalFontSize, state.phones, state.is_need_avg_time, state.avgTime ]));
  
  const [ logogout ] = useLoginStore(useShallow( state => [ state.logogout ]));

  const dialCall = useDialCall();

  const logOut = async () => {
    logogout();
    navigate('Auth');
  };

  return (
    <DrawerContentScrollView {...props}>
    
      { is_need_avg_time &&
        <DrawerItem
          activeTintColor="#c03"
          inactiveTintColor="#000"
          label={"Ср. время: "+avgTime}
          onPress={ () => {} }
          labelStyle={{fontSize: globalFontSize }}
        />
      }

      <DrawerItemList {...props} />

      { phones?.phone_upr ?
        <DrawerItem
          activeTintColor="#c03"
          inactiveTintColor="#000"
          label="Директор"
          //onPress={ () => {} }
          
          onPress={() => dialCall(phones?.phone_upr)}
          labelStyle={{fontSize: globalFontSize }}
        />
          :
        false
      }
      { phones?.phone_man ?
        <DrawerItem
          activeTintColor="#c03"
          inactiveTintColor="#000"
          label="Менеджер"
          //onPress={ () => {} }
          onPress={() => dialCall(phones?.phone_man)}
          labelStyle={{fontSize: globalFontSize }}
        />
          :
        false
      }
      { phones?.phone_center ?
        <DrawerItem
          label="Контакт-центр"
          activeTintColor="#c03"
          inactiveTintColor="#000"
          //onPress={ () => {} }
          onPress={() => dialCall(phones?.phone_center)}
          labelStyle={{fontSize: globalFontSize }}
        />
          :
        false
      }
      <DrawerItem
        label="Выйти"
        activeTintColor="#c03"
        inactiveTintColor="#000"
        //onPress={ () => {} }
        onPress={logOut}
        labelStyle={{fontSize: globalFontSize }}
      />
    </DrawerContentScrollView>
  );
})