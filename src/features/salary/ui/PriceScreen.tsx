import React from 'react'
import { View, ScrollView, RefreshControl, Text } from 'react-native'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/shared/ui/Calendar'
import { Divider } from '@/components/ui/divider'
import { TextDescription } from './TextDescription'
import { usePriceScreen } from '../model/usePriceScreen'

import { ScreenLayout } from '@/shared/ui/ScreenLayout'

export function PriceScreen(): React.JSX.Element {
  const {
    statPrice,
    give_history,
    FormatPrice,
    date,
    showDate,
    setDate,
    showCalendar,
    setShowCalendar,
    isRefreshing,
    setIsRefreshing,
    chooseDate,
    globalFontSize
  } = usePriceScreen()

  return (
    <ScreenLayout>
      <Calendar
        is_show={showCalendar}
        date={date}
        changeDate={chooseDate}
        setShowCalendar={setShowCalendar}
      />

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={ () => chooseDate(date) }
          />
        }
      >
        <View className='m-5 p-5 bg-white rounded-xl shadow-zinc-500 shadow'>
          <Button onPress={() => setShowCalendar(true)} variant="outline" className='rounded-lg border-gray-200 justify-center items-center h-auto mb-5'>
            
            <View className='flex-row items-center pt-3 pb-3'>
              <Text className='font-bold' style={{ fontSize: globalFontSize }}>Дата: </Text>
              <Text style={{ fontSize: globalFontSize }}>{showDate}</Text>
            </View>
          </Button>


          <View className='flex-row items-center text-center justify-center w-full pt-3 pb-3'>
            <Text className='font-bold text-5xl'>{FormatPrice(statPrice?.my_price ?? 0)} ₽</Text>
          </View>

          <TextDescription 
            text='Сумма налички'
            value={statPrice?.sum_cash ?? 0} 
            type='price'
            FormatPrice={FormatPrice}
            title='Сумма заказов за наличку за выбранную дату, включая стоимость доставки'
            globalFontSize={globalFontSize}
          />

          <TextDescription 
            text='Сумма безнала'
            value={statPrice?.sum_bank ?? 0} 
            type='price'
            FormatPrice={FormatPrice}
            title='Сумма заказов по безналичному расчету за выбранную дату, включая стоимость доставки'
            globalFontSize={globalFontSize}
          />

          <TextDescription 
            text='Заработал'
            value={statPrice?.my_price ?? 0} 
            type='price'
            FormatPrice={FormatPrice}
            title='Сумма стоимости доставки для курьера за выбранную дату + доплаты за этот же день'
            globalFontSize={globalFontSize}
            
          />
          
          <TextDescription 
            text='Сдача'
            value={statPrice?.sdacha ?? 0} 
            type='price'
            FormatPrice={FormatPrice}
            title='Из графы Сумма налички вычитаем графу Заработал'
            globalFontSize={globalFontSize}
          />

          <TextDescription 
            text='Налички'
            value={statPrice?.my_cash ?? 0} 
            type='price'
            FormatPrice={FormatPrice}
            title='Разница между графой К сдаче и графой Сдал - за все время на точке'
            globalFontSize={globalFontSize}
          />

          <TextDescription 
            text='Количество по наличке'
            value={statPrice?.count_cash ?? 0} 
            type='count'
            FormatPrice={FormatPrice}
            globalFontSize={globalFontSize}
          />

          <TextDescription 
            text='Количество по безналу'
            value={statPrice?.count_bank ?? 0} 
            type='count'
            FormatPrice={FormatPrice}
            globalFontSize={globalFontSize}
          />
          
          <TextDescription 
            text='Завершенных заказов'
            value={statPrice?.count ?? 0} 
            type='count'
            FormatPrice={FormatPrice}
            bottom_devider={false}
            globalFontSize={globalFontSize}
          />
        </View>

        <View className='m-5 p-5 mt-0 bg-white rounded-xl shadow-zinc-500 shadow'>
          { (statPrice?.full_give ?? 0) > 0 ?
            <>
              <View className='flex-row items-center pb-3'>
                <Text className='font-bold w-2/4' style={{ fontSize: globalFontSize }}>Время</Text>
                <Text className='font-bold w-2/4 text-right' style={{ fontSize: globalFontSize }}>Сданная сумма</Text>
              </View>

              <Divider />
            </>
              : 
            null
          }

          { give_history?.map((item, index) => {
            return (
              <View key={index} className='flex-row items-center pb-3 pt-3'>
                <Text className='w-2/4' style={{ fontSize: globalFontSize }}>{item.time}</Text>
                <Text className='w-2/4 text-right' style={{ fontSize: globalFontSize }}>{FormatPrice(item.give)} ₽</Text>
              </View>
            )
          })}
          
          { (statPrice?.full_give ?? 0) > 0 ?
            <Divider />
              :
            null
          }
          
          <View className={ (statPrice?.full_give ?? 0) > 0 ? 'flex-row items-center pb-3 pt-3' : 'flex-row items-center pb-3'}>
            <Text className='font-bold w-2/4' style={{ fontSize: globalFontSize }}>Всего сдал</Text>
            <Text className='font-bold w-2/4 text-right' style={{ fontSize: globalFontSize }}>{FormatPrice(statPrice?.full_give ?? 0)} ₽</Text>
          </View>
          
          <Divider />

          <View className='flex-row items-center pt-3'>
            <Text className='font-bold w-2/4' style={{ fontSize: globalFontSize }}>Осталось сдать</Text>
            <Text className='font-bold w-2/4 text-right' style={{ fontSize: globalFontSize }}>{FormatPrice(statPrice?.my_cash ?? 0)} ₽</Text>
          </View>

        </View>
        
      </ScrollView>
    </ScreenLayout>
  )
}