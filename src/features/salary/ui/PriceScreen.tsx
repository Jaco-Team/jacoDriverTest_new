import React from 'react'
import { View, ScrollView, RefreshControl, Text } from 'react-native'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/shared/ui/Calendar'
import { Divider } from '@/components/ui/divider'
import { TextDescription } from './TextDescription'
import { usePriceScreen } from '../model/usePriceScreen'

import { ScreenLayout } from '@/shared/ui/ScreenLayout'

import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';

export function PriceScreen(): React.JSX.Element {
   const {
    statPrice,
    give_history,
    FormatPrice,
    dateStart,
    dateEnd,
    showDateStart,
    showDateEnd,
    showStartCalendar,
    setShowStartCalendar,
    showEndCalendar,
    setShowEndCalendar,
    isRefreshing,
    refresh,
    chooseStartDate,
    chooseEndDate,

    globalFontSize
  } = usePriceScreen()

  return (
    <ScreenLayout>
      <Calendar
        is_show={showStartCalendar}
        date={dateStart}
        changeDate={(d) => { chooseStartDate(d); setShowStartCalendar(false); Analytics.log(AnalyticsEvent.PriceStartCalendarClose, 'Закрытие календаря (Расчет): Дата от'); }}
        setShowCalendar={setShowStartCalendar}
      />
      <Calendar
        is_show={showEndCalendar}
        date={dateEnd}
        changeDate={(d) => { chooseEndDate(d); setShowEndCalendar(false); Analytics.log(AnalyticsEvent.PriceEndCalendarClose, 'Закрытие календаря (Расчет): Дата до'); }}
        setShowCalendar={setShowEndCalendar}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        <View className='m-5 mb-0'>
          <Button
            onPress={() => { setShowStartCalendar(true); Analytics.log(AnalyticsEvent.PriceStartCalendarOpen, 'Открытие календаря (Расчет): Дата от'); }}
            variant='outline'
            className='w-full rounded-lg border-gray-200 h-auto mb-3 bg-white'
          >
            <View className='flex-row items-center pt-3 pb-3'>
              <Text className='font-bold' style={{ fontSize: globalFontSize }}>Дата от: </Text>
              <Text style={{ fontSize: globalFontSize }}>{showDateStart}</Text>
            </View>
          </Button>

          <Button
            onPress={() => {setShowEndCalendar(true); Analytics.log(AnalyticsEvent.PriceEndCalendarOpen, 'Открытие календаря (Расчет): Дата до'); }}
            variant='outline'
            className='w-full rounded-lg border-gray-200 h-auto bg-white'
          >
            <View className='flex-row items-center pt-3 pb-3'>
              <Text className='font-bold' style={{ fontSize: globalFontSize }}>Дата до: </Text>
              <Text style={{ fontSize: globalFontSize }}>{showDateEnd}</Text>
            </View>
          </Button>
        </View>

        <View className='m-5 p-5 bg-white rounded-xl shadow-zinc-500 shadow'>
          <View className='flex-row items-center text-center justify-center w-full pt-3 pb-3'>
            <Text className='font-bold text-5xl'>{FormatPrice(statPrice?.my_price ?? 0)} ₽</Text>
          </View>

          <TextDescription text='Сумма налички' value={statPrice?.sum_cash ?? 0} type='price'
            FormatPrice={FormatPrice} title='Сумма заказов за наличку за выбранный диапазон, включая стоимость доставки'
            globalFontSize={globalFontSize}
          />

          <TextDescription text='Сумма безнала' value={statPrice?.sum_bank ?? 0} type='price'
            FormatPrice={FormatPrice} title='Сумма заказов по безналичному расчету за выбранный диапазон, включая стоимость доставки'
            globalFontSize={globalFontSize}
          />

          <TextDescription text='Заработал' value={statPrice?.my_price ?? 0} type='price'
            FormatPrice={FormatPrice} title='Сумма стоимости доставки для курьера за выбранный диапазон + доплаты за период'
            globalFontSize={globalFontSize}
          />

          <TextDescription text='Сдача' value={statPrice?.sdacha ?? 0} type='price'
            FormatPrice={FormatPrice} title='Из графы Сумма налички вычитаем графу Заработал'
            globalFontSize={globalFontSize}
          />

          <TextDescription text='Налички' value={statPrice?.my_cash ?? 0} type='price'
            FormatPrice={FormatPrice} title='Разница между графой К сдаче и графой Сдал за весь период'
            globalFontSize={globalFontSize}
          />

          <TextDescription text='Количество по наличке' value={statPrice?.count_cash ?? 0} type='count'
            FormatPrice={FormatPrice} globalFontSize={globalFontSize}
          />

          <TextDescription text='Количество по безналу' value={statPrice?.count_bank ?? 0} type='count'
            FormatPrice={FormatPrice} globalFontSize={globalFontSize}
          />

          <TextDescription text='Завершенных заказов' value={statPrice?.count ?? 0} type='count'
            FormatPrice={FormatPrice} bottom_devider={false} globalFontSize={globalFontSize}
          />
        </View>

        <View className='m-5 p-5 mt-0 bg-white rounded-xl shadow-zinc-500 shadow'>
          {(statPrice?.full_give ?? 0) > 0 && (
            <>
              <View className='flex-row items-center pb-3'>
                <Text className='font-bold w-2/4' style={{ fontSize: globalFontSize }}>Время</Text>
                <Text className='font-bold w-2/4 text-left' style={{ fontSize: globalFontSize }}>Сданная сумма</Text>
              </View>
              <Divider />
            </>
          )}

          {give_history?.map((item, index) => (
            <React.Fragment key={index}>
              <View className='flex-row items-center pb-3 pt-3'>
                <Text className='w-2/4' style={{ fontSize: globalFontSize }}>{item.time}</Text>
                <Text className='w-2/4 text-left' style={{ fontSize: globalFontSize }}>
                  {FormatPrice(item.give)} ₽
                </Text>
              </View>
              {index < ((give_history?.length ?? 0) - 1) && <Divider />}
            </React.Fragment>
          ))}

          {(statPrice?.full_give ?? 0) > 0 && <Divider />}

          <View className={(statPrice?.full_give ?? 0) > 0 ? 'flex-row items-center pb-3 pt-3' : 'flex-row items-center pb-3'}>
            <Text className='font-bold w-2/4' style={{ fontSize: globalFontSize }}>Всего сдал</Text>
            <Text className='font-bold w-2/4 text-left' style={{ fontSize: globalFontSize }}>
              {FormatPrice(statPrice?.full_give ?? 0)} ₽
            </Text>
          </View>

          <Divider />

          <View className='flex-row items-center pt-3'>
            <Text className='font-bold w-2/4' style={{ fontSize: globalFontSize }}>Осталось сдать</Text>
            <Text className='font-bold w-2/4 text-left' style={{ fontSize: globalFontSize }}>
              {FormatPrice(statPrice?.my_cash ?? 0)} ₽
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  )
}
