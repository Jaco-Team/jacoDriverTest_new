import React, {ReactNode} from 'react';
import {View} from 'react-native';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import {UiProvider} from './UiProviders';
import {NavigationProvider} from './NavigationProvider';

import {CustomSpinner} from '@/shared/ui/CustomSpinner';
import {CustomSpinner_hidden} from '@/shared/ui/CustomSpinner_hidden';
import {CustomAlert} from '@/shared/ui/CustomAlert';
import {ModalText} from '@/shared/ui/ModalText';
import {ConnectivityProvider} from '@/shared/ui/ConnectivityLocationIndicator';
import {AppThemeProvider, useAppTheme} from '@/shared/theme/AppThemeProvider';
import {useGlobalStore} from '@/shared/store/store';
import {useOfflineCityDownloads} from '@/features/offline-map/model/useOfflineCityDownloads';

function OfflineCityDownloads() {
  useOfflineCityDownloads();
  return null;
}

function ThemedAppProviders({children}: {children: ReactNode}) {
  const {colors} = useAppTheme()
  const alertBannerRef = React.useRef<View>(null)

  return (
    <View
      style={{flex: 1, backgroundColor: colors.surface}}
      onStartShouldSetResponderCapture={event => {
        if (!useGlobalStore.getState().is_show_alert_text) return false

        const {pageX, pageY} = event.nativeEvent
        alertBannerRef.current?.measureInWindow((x, y, width, height) => {
          const isOutside = pageX < x || pageX > x + width || pageY < y || pageY > y + height
          if (isOutside) useGlobalStore.getState().showAlertText(false)
        })
        return false
      }}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <BottomSheetModalProvider>
          <UiProvider>
            <ConnectivityProvider>
              <OfflineCityDownloads />
              <NavigationProvider>
                {children}

                <CustomSpinner />
                <CustomSpinner_hidden />
                <CustomAlert bannerRef={alertBannerRef} />
                <ModalText />
              </NavigationProvider>
            </ConnectivityProvider>
          </UiProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </View>
  )
}

export function AppProviders({children}: {children: ReactNode}) {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <AppThemeProvider>
        <ThemedAppProviders>{children}</ThemedAppProviders>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
