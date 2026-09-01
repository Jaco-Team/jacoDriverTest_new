import { useFocusEffect, useNavigation, ParamListBase } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useCallback } from 'react'
import { useLoginStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'

export function useGreetingLogic() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
  const [ check_token ] = useLoginStore(useShallow(state => [state.check_token]))

  useFocusEffect(
    useCallback(() => {
      let isFocused = true

      const check = async () => {
        const token = await check_token()
        if (!isFocused) return

        navigation.reset({
          index: 0,
          routes: [{ name: token === true ? 'List_orders' : 'Auth' }],
        })
      }

      void check()

      return () => {
        isFocused = false
      }
    }, [check_token, navigation])
  )
}
