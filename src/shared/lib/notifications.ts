import { Platform, Linking, Alert } from 'react-native';
import notifee, { AuthorizationStatus, AndroidImportance } from '@notifee/react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, getToken, onMessage, setBackgroundMessageHandler } from '@react-native-firebase/messaging';

/**
 * Обработчик входящего сообщения
 */
async function onMessageReceived(message: any) {
  const { title, body } = message.notification || {};
  //const { title, body } = message.data || {};
  //console.log('Received message:', message);

  // Создаем канал для уведомлений (Android)
  const channelId = await notifee.createChannel({
    id: 'jacodriver',
    name: 'jacodriver Channel',
    // Указываем sound, если хотим дефолтный звук
    sound: 'default',
    // Задаем высокий приоритет, чтобы звук точно проигрался
    importance: AndroidImportance.HIGH,
  });

  if( title.length > 0 && body.length > 0 ){
    await notifee.displayNotification({
      title: title,
      body: body,
      android: {
        channelId,
        sound: 'default',
        importance: AndroidImportance.HIGH
      },
      ios: {
        sound: 'default',
        foregroundPresentationOptions: {
          sound: true,
          banner: true,
          list: true,
        },
      },
    });
  }
}

/**
 * Инициализация уведомлений.
 * - Запрашиваем разрешения через notifee.
 * - Получаем токен устройства через модульный API Firebase.
 * - Устанавливаем обработчики входящих сообщений.
 */
export async function initializeNotifications(setNotifToken: (token: string) => void) {
  // Получаем экземпляр приложения и мессенджинга
  const app = getApp();
  const messagingInstance = getMessaging(app);

  // Запрашиваем разрешение на уведомления
  const settings = await notifee.requestPermission({
    criticalAlert: true,
    announcement: true,
    sound: true,
    provisional: true,
  });
  //console.log('Notification permission settings:', settings);

  // Получаем токен устройства
  const token = await getToken(messagingInstance);
  setNotifToken(token);
  //console.log('Device token:', token);

  // Устанавливаем обработчики входящих сообщений
  onMessage(messagingInstance, onMessageReceived);
  //setBackgroundMessageHandler(messagingInstance, onMessageReceived);
}

// добавлял при настройке jest, но пока не используется
// type Unsub = () => void;
// export async function initializeNotifications(
//     setNotifToken: (token: string) => void
//   ): Promise<Unsub> {
//     const app = getApp();
//     const messaging = getMessaging(app);

//     try {
//       await notifee.requestPermission({
//         criticalAlert: true,
//         announcement: true,
//         sound: true,
//         provisional: true,
//       });
//     } catch {}

//     try {
//       const token = await getToken(messaging);
//       if (token) setNotifToken(token);
//     } catch {}

//     // ВАЖНО: onMessage возвращает функцию отписки — её и вернём наружу
//     const unsubscribeOnMessage = onMessage(messaging, onMessageReceived);

//     return () => {
//       try { unsubscribeOnMessage(); } catch {}
//     };
//   }

/**
 * Запрос разрешения на уведомления.
 * Если уведомления запрещены, выводим Alert с предложением открыть настройки.
 */
export async function requestNotificationPermission() {
  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings://');
    } else {
      Linking.openSettings();
    }
  };

  // Получаем текущие настройки уведомлений
  const settings = await notifee.getNotificationSettings();

  if (settings.authorizationStatus === AuthorizationStatus.NOT_DETERMINED) {
    const newSettings = await notifee.requestPermission();
    if (newSettings.authorizationStatus === AuthorizationStatus.AUTHORIZED) {
      console.log('Notifications authorized');
    } else {
      console.log('Notifications not authorized');
    }
  } else if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
    Alert.alert(
      'Разрешите уведомления',
      'Чтобы получать важные уведомления, включите их в настройках приложения.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Открыть настройки', onPress: openSettings },
      ],
      { cancelable: false }
    );
  }
}
