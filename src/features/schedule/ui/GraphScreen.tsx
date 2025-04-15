import React from 'react'
import { View, ScrollView, RefreshControl } from 'react-native'

import { GraphTable } from '@/features/schedule/ui/GraphTable'
import { ChooseMonth } from '@/features/schedule/ui/ChooseMonth'
import { ErrOrders } from '@/features/schedule/ui/ErrOrders'
import { ErrCamera } from '@/features/schedule/ui/ErrCamera'

import { ScreenLayout } from '@/shared/ui/ScreenLayout'

import { useGraphLogic } from '../model/useGraphLogic'

export function GraphScreen(): React.JSX.Element {
  const { isRefreshing, handleRefresh } = useGraphLogic()

  return (
    <ScreenLayout>
      <ScrollView
        horizontal={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        <ChooseMonth />
        <GraphTable />
        <ErrOrders />
        <ErrCamera />

        {/* Отступ внизу, чтобы можно было проскроллить */}
        <View className="w-full h-20" />
      </ScrollView>
    </ScreenLayout>
  )
}