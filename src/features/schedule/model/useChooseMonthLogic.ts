import { useStatStore, useGlobalStore } from '@/shared/store/store'
import { useShallow } from 'zustand/react/shallow'
import { useEffect, useState } from 'react'

export function useChooseMonthLogic() {
  const [getGraph, month_list] = useStatStore(
    useShallow((state) => [state.getGraph, state.month_list])
  )

  const [globalFontSize] = useGlobalStore(useShallow((state) => [state.globalFontSize]))

  const [isOpenDateMenu, setIsOpenDateMenu] = useState(false)
  const [activeMounth, setActiveMounth] = useState('')

  useEffect(() => {
    const my_m = month_list.find((it) => it.is_active === 1)
    if (my_m) {
      setActiveMounth(my_m.mounth)
    }
  }, [month_list])

  const onSelectMonth = (day: string, mounth: string) => {
    setIsOpenDateMenu(false)
    getGraph(day)
    setActiveMounth(mounth)
  }

  return {
    month_list,
    activeMounth,
    isOpenDateMenu,
    setIsOpenDateMenu,
    onSelectMonth,
    globalFontSize
  }
}