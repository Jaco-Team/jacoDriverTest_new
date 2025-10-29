import React from 'react'
import { Text, TouchableOpacity, Platform } from 'react-native'
import {
  Actionsheet,
  ActionsheetContent,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetBackdrop,
} from '@/components/ui/actionsheet'
import { useChooseMonthLogic } from '../model/useChooseMonthLogic'

import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';

export function ChooseMonth(): React.JSX.Element {
  const {
    month_list,
    activeMounth,
    isOpenDateMenu,
    setIsOpenDateMenu,
    onSelectMonth,
    globalFontSize
  } = useChooseMonthLogic()

  return (
    <>
      <TouchableOpacity
        className="flex-row items-center text-center justify-center w-full pt-6 pb-0"
         onPress={() => {
          Analytics.log(AnalyticsEvent.GraphMonthPickerOpen, 'Открытие выбора месяца (График работы)');
          setIsOpenDateMenu(true);
        }}
      >
        <Text className="font-bold text-5xl">{activeMounth}</Text>
      </TouchableOpacity>

      <Actionsheet 
        isOpen={isOpenDateMenu} 
        onClose={() => {
          Analytics.log(AnalyticsEvent.GraphMonthPickerClose, 'Закрытие выбора месяца (График работы)');
          setIsOpenDateMenu(false);
        }}
      >
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          {month_list.map((item, index) => (
            <ActionsheetItem
              key={index}
              onPress={() => {
                Analytics.log(AnalyticsEvent.GraphMonthSelected, 'Выбор месяца (График работы)');
                Analytics.log(AnalyticsEvent.GraphMonthPickerClose, 'Закрытие выбора месяца (График работы)');
                onSelectMonth(item.day, item.mounth);     
                setIsOpenDateMenu(false);
              }}
              className={ `${index === 0 || index === 1 ? 'border-b border-gray-200' : ''} flex-row items-center justify-center w-full ${Platform.OS === 'ios' ? 'h-12' : 'h-auto'}` }
            >
              <ActionsheetItemText
                style={{ fontSize: globalFontSize * 1.2 }}
                className="pt-2 pb-2 text-center h-auto leading-7"
              >
                {item.mounth}
              </ActionsheetItemText>
            </ActionsheetItem>
          ))}

          <ActionsheetItem className="mb-4" />
        </ActionsheetContent>
      </Actionsheet>
    </>
  )
}
