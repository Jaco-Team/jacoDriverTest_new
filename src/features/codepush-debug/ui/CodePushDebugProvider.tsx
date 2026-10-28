import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Modal} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {useActiveRouteName} from '@/app/providers/NavigationProvider';
import {codePushDiagnosticsStore} from '@/codePush/diagnosticsStore';
import {codePushReadiness} from '@/codePush/readiness';
import {useAppTheme} from '@/shared/theme/AppThemeProvider';
import {CodePushDebugScreen} from './CodePushDebugScreen';

interface CodePushDebugControls {
  open: () => void;
  close: () => void;
}

// Isolated screens/previews without this optional host keep their normal behavior.
const CodePushDebugContext = createContext<CodePushDebugControls>({open: () => {}, close: () => {}});

export function useCodePushDebug(): CodePushDebugControls {
  return useContext(CodePushDebugContext);
}

/** UI-only host. Neither opening nor closing changes navigation, readiness or native state. */
export function CodePushDebugProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const route = useActiveRouteName();
  const {colors} = useAppTheme();
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const openingRoute = useRef<string | null>(null);

  const close = useCallback(() => {
    visibleRef.current = false;
    openingRoute.current = null;
    setVisible(false);
  }, []);

  const open = useCallback(() => {
    if (visibleRef.current) return;
    const readiness = codePushReadiness.getSnapshot();
    // A delayed gesture cannot cross the current route or the initial restore barrier.
    if (route === 'Greeting' || readiness.route !== route || readiness.outcome === 'restoring') return;
    if (route === 'Auth' && readiness.committedScreen !== 'Auth') return;
    // An actual Auth commit with outcome=error may inspect diagnostics without any ACK.
    openingRoute.current = route;
    visibleRef.current = true;
    setVisible(true);
    void codePushDiagnosticsStore.refresh();
  }, [route]);

  useEffect(() => {
    if (visibleRef.current && openingRoute.current !== route) close();
  }, [close, route]);

  const controls = useMemo(() => ({open, close}), [open, close]);
  const shown = visible && openingRoute.current === route;

  return (
    <CodePushDebugContext.Provider value={controls}>
      {children}
      <Modal
        visible={shown}
        presentationStyle="fullScreen"
        animationType="none"
        transparent={false}
        statusBarTranslucent
        navigationBarTranslucent
        backdropColor={colors.surface}
        onRequestClose={close}
      >
        <SafeAreaProvider>
          <CodePushDebugScreen onClose={close} />
        </SafeAreaProvider>
      </Modal>
    </CodePushDebugContext.Provider>
  );
}
