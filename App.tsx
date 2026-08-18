import '@/shared/lib/reanimatedGuard'
import React from 'react';

import { AppProviders } from '@/app/providers/AppProviders'
import { RootNavigator } from '@/app/navigation/RootNavigator'

import {Analytics, installJsCrashHandler, reportSentryEventToAppMetrica} from '@/analytics/AppMetricaService';

import * as Sentry from "@sentry/react-native";

Analytics.init();
installJsCrashHandler();

Sentry.init({
  dsn: "https://55969b9f226cda7d6ed21a48b5e4d776@o4505941569830912.ingest.us.sentry.io/4511698859458560",
  release: "jacoDriverTest@4.0",
  sendDefaultPii: true,
  debug: false,
  beforeSend(event, hint) {
    try {
      reportSentryEventToAppMetrica(hint, event);
    } catch {}
    return event;
  },
});

import "./global.css"

import { initYaMap } from '@/shared/lib/yaMapInit';

initYaMap();

function App(): React.JSX.Element {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

export default Sentry.wrap(App);
