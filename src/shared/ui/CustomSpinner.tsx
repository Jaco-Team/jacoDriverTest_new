import { Spinner } from "@/components/ui/spinner"
import { Center } from "@/components/ui/center"

import { useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'
import { useActiveRouteName } from '@/app/providers/NavigationProvider'

export function CustomSpinner(): React.JSX.Element | null {

  const [loadSpinner] = useGlobalStore(useShallow( state => [ state.loadSpinner]));
  const activeRouteName = useActiveRouteName()

  if( !loadSpinner || activeRouteName === 'Greeting' ) return null;

  return (
    <Center className="absolute w-full h-full bg-black opacity-75 z-50">
      <Spinner size={'large'} />
    </Center>
  )
}
