// /**
//  * @format
//  */

// import {AppRegistry} from 'react-native';
// import App from './App';
// import {name as appName} from './app.json';

// AppRegistry.registerComponent(appName, () => App);

/**
 * @format
 */
import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

if (__DEV__) {
  // 'off' — всё реальное
  // 'actions' — списки/карточки реальные, ТОЛЬКО действия фейк
  global.__FAKE_ORDERS__ = 'off';
} else {
  // На всякий случай убираем все dev-флаги в релизе
  // (если кто-то случайно оставит)
  try { delete global.__FAKE_ORDERS__; } catch {}
  try { delete global.__FAKE_HIDDEN_IDS__; } catch {}
}

AppRegistry.registerComponent(appName, () => App);

