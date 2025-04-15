import { Linking, Platform } from 'react-native';

import { useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

export const useDialCall = () => {

  const [ showAlertText ] = useGlobalStore(useShallow( state => [ state.showAlertText ]) );

  const dialCall = (phone: string | undefined) => {
    if (!phone || phone.length === 0) {
      showAlertText(true, `Номер телефона не указан, или нет данных: ${phone}`);
      return;
    }

    let phoneNumber = phone;

    if (Platform.OS !== 'android') {
      phoneNumber = `telprompt:${phone}`;
    } else {
      phoneNumber = `tel:${phone}`;
    }

    Linking.canOpenURL(phoneNumber)
      .then(supported => {
        if (supported) {
          return Linking.openURL(phoneNumber).catch(() => null);
        } else {
          showAlertText(true, 'Невозможно открыть URL: ' + phoneNumber);
          //console.log('Невозможно открыть URL: ', phoneNumber);
        }
      })
      .catch(err => console.error('Ошибка при попытке звонка', err));
  };

  return dialCall;
};