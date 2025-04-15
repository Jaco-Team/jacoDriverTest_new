import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useGraphTable } from '../model/useGraphTable'
import { GraphTableView } from './GraphTableView'

export function GraphTable() {
  const { thisDay, headerDay, headerDow, users, user_name, globalFontSize } = useGraphTable()

  // Если заголовки для таблицы не готовы — считаем, что «загрузка...»
  if (headerDay.length === 0) {
    return (
      <View className="m-5 p-5 bg-white rounded-xl shadow-zinc-500 shadow">
        <Text className="text-center text-typography-950 text-lg">Загрузка...</Text>
      </View>
    )
  }

  return (
    <View className="m-5 p-5 bg-white rounded-xl shadow-zinc-500 shadow">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
        <GraphTableView
          headerDay={headerDay}
          headerDow={headerDow}
          users={users}
          userName={user_name}
          thisDay={thisDay}
          globalFontSize={globalFontSize}
        />
      </ScrollView>
    </View>
  )
}