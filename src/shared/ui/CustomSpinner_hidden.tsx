import { Spinner } from "@/components/ui/spinner"
import { Center } from "@/components/ui/center"

import { useGlobalStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

export function CustomSpinner_hidden(): React.JSX.Element | null {

  const [loadSpinnerHidden] = useGlobalStore(useShallow( state => [ state.loadSpinnerHidden]));

  if( !loadSpinnerHidden ) return null;

  return (
    <Center className="absolute w-1 h-1 bg-transparent opacity-0">
      <Spinner size={'large'} />
    </Center>
  )
}

