import { useFocusEffect, useNavigation, ParamListBase } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useCallback } from 'react'
import { useLoginStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'

export function useGreetingLogic() {
  const { navigate } = useNavigation<NativeStackNavigationProp<ParamListBase>>()
  const [ check_token ] = useLoginStore(useShallow(state => [state.check_token]))

  useFocusEffect(
    useCallback(() => {
      const check = async () => {
        const token = await check_token()
        if (token === true) {
          navigate('List_orders')
        } else {
          navigate('Auth')
        }
      }
      check()
    }, [check_token, navigate])
  )
}