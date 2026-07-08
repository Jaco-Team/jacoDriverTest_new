import React from 'react';

import { AppProviders } from '@/app/providers/AppProviders'
import { RootNavigator } from '@/app/navigation/RootNavigator'

import {Analytics, installJsCrashHandler} from '@/analytics/AppMetricaService';

import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://55969b9f226cda7d6ed21a48b5e4d776@o4505941569830912.ingest.us.sentry.io/4511698859458560",
  release: "jacoDriverTest@0.0.2",
  sendDefaultPii: true,
  debug: false,
});

import "./global.css"

import YaMap from 'react-native-yamap';

YaMap.init('c7ad032b-5368-4449-9e21-c50d73ea0026');
//YaMap.setLocale('ru_RU');

Analytics.init();

function App(): React.JSX.Element {
  React.useEffect(() => {
    installJsCrashHandler();
  }, []);

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

export default Sentry.wrap(App);
