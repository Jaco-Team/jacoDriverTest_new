import React from 'react'
import { View, Text, ScrollView, RefreshControl } from 'react-native'
import { Button } from '@/components/ui/button'
import { Divider } from '@/components/ui/divider'
import { Calendar } from '@/shared/ui/Calendar'
import { useStatisticsTable } from '../model/useStatisticsTable'
import { StatisticsTableView } from './StatisticsTableView'

export function StatisticsTableScreen() {
  // Бизнес-логика (даты, загрузка данных) из хука
  const {
    statArr,
    dateStart,
    dateEnd,
    showCalendarStart,
    setShowCalendarStart,
    showCalendarEnd,
    setShowCalendarEnd,
    isRefreshing,
    onRefresh,
    chooseDateStart,
    chooseDateEnd,
    globalFontSize
  } = useStatisticsTable()

  // Если данных нет (или идет загрузка), можно показывать заглушку:
  if (statArr.length === 0) {
    return (
      <View className="m-5 p-5 bg-white rounded-xl shadow-zinc-500 shadow">
        <Text className="text-center text-typography-950 text-lg">Загрузка...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <View className="m-5 p-5 bg-white rounded-xl shadow-zinc-500 shadow">
        {/* Модалки для выбора дат */}
        <Calendar
          is_show={showCalendarStart}
          date={dateStart}
          changeDate={chooseDateStart}
          setShowCalendar={setShowCalendarStart}
        />
        <Calendar
          is_show={showCalendarEnd}
          date={dateEnd}
          changeDate={chooseDateEnd}
          setShowCalendar={setShowCalendarEnd}
        />

        {/* Кнопка «Дата от» */}
        <Button
          onPress={() => setShowCalendarStart(true)}
          variant="outline"
          className="rounded-lg border-gray-200 justify-center items-center h-auto mb-5"
        >
          <View className="flex-row items-center pt-3 pb-3">
            <Text className="font-bold" style={{ fontSize: globalFontSize }}>
              Дата от:{' '}
            </Text>
            <Text style={{ fontSize: globalFontSize }}>{dateStart}</Text>
          </View>
        </Button>

        {/* Кнопка «Дата до» */}
        <Button
          onPress={() => setShowCalendarEnd(true)}
          variant="outline"
          className="rounded-lg border-gray-200 justify-center items-center h-auto mb-5"
        >
          <View className="flex-row items-center pt-3 pb-3">
            <Text className="font-bold" style={{ fontSize: globalFontSize }}>
              Дата до:{' '}
            </Text>
            <Text style={{ fontSize: globalFontSize }}>{dateEnd}</Text>
          </View>
        </Button>

        <Divider className="mb-5" />

        {/* Вызов компонента таблицы */}
        <StatisticsTableView statArr={statArr} globalFontSize={globalFontSize} />
      </View>
    </ScrollView>
  )
}