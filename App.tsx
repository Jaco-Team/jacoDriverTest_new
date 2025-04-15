import React from 'react';

import { AppProviders } from '@/app/providers/AppProviders'
import { RootNavigator } from '@/app/navigation/RootNavigator'

import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://46fd354338d2a29a928cda10c1f0acb8@sentry.jacochef.ru/3",
  release: "jacoDriverTest@0.0.2",
  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,
});

import "./global.css"

import YaMap from 'react-native-yamap';

YaMap.init('c7ad032b-5368-4449-9e21-c50d73ea0026');
//YaMap.setLocale('ru_RU');

function App(): React.JSX.Element {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

export default Sentry.wrap(App);
