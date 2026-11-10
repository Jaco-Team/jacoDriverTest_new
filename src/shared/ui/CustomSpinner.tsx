import { StyleSheet } from 'react-native'

import { Spinner } from "@/components/ui/spinner"
import { Center } from "@/components/ui/center"

import { useGEOStore, useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'
import { useActiveRouteName } from '@/app/providers/NavigationProvider'
import { LocationWaitCountdown } from './LocationWaitCountdown'

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
})

export function CustomSpinner(): React.JSX.Element | null {

  const [loadSpinner] = useGlobalStore(useShallow( state => [ state.loadSpinner]));
  const isLocationWait = useGEOStore(state => state.location_wait !== null)
  const activeRouteName = useActiveRouteName()

  if( !loadSpinner || activeRouteName === 'Greeting' ) return null;

  // Затемнение задано цветом фона, а не прозрачностью всего слоя: иначе спиннер и
  // отсчёт геопозиции тоже становились бы полупрозрачными. Слой рисуется поверх
  // окна подтверждения действия, поэтому отсчёт показываем только здесь: пока
  // ждём геопозицию, кольцо с секундами заменяет обычный спиннер.
  return (
    <Center className="absolute w-full h-full z-50" style={styles.backdrop}>
      {isLocationWait ? <LocationWaitCountdown /> : <Spinner size={'large'} />}
    </Center>
  )
}
