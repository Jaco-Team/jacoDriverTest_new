import React from 'react'
import {
  View,
  Text,
  ScrollView,
} from 'react-native'

import ColorPicker from 'react-native-wheel-color-picker'
import { VStack } from '@/components/ui/vstack'

import { Button, ButtonText } from '@/components/ui/button'
import { Center } from '@/components/ui/center'
import {
  Slider,
  SliderThumb,
  SliderTrack,
  SliderFilledTrack
} from '@/components/ui/slider'
import {
  Checkbox,
  CheckboxIndicator,
  CheckboxLabel,
  CheckboxIcon,
  CheckboxGroup
} from '@/components/ui/checkbox'
import { CheckIcon } from '@/components/ui/icon'
import {
  Radio,
  RadioGroup,
  RadioIndicator,
  RadioLabel,
  RadioIcon
} from '@/components/ui/radio'
import { CircleIcon } from '@/components/ui/icon'

import { DelType } from '@/shared/types/globalTypes'

import { useSettingsLogic } from "../model/useSettingsLogic"
import { MapPointTime } from './MapPointTime'
import { MapPointTheme } from './MapPointTheme'
import { ScreenLayout } from '@/shared/ui/ScreenLayout'

export function SettingsScreen(): React.JSX.Element {
  const {
    globalFontSize,
    type_show_delState,
    setType_show_del,
    centered_mapState,
    setCentered_map,
    fontSizeState,
    setFontSize,
    update_intervalState,
    setUpdate_interval,
    colorState,
    setColor,
    swatchesLoadingState,
    setSwatchesLoading,
    groupTypeTimeState,
    setGroupTypeTime,
    groupTypeThemeState,
    setGroupTypeTheme,
    mapScaleState,
    setMapScale,
    night_mapState, 
    setNight_map,
    setScale_map,
    is_scaleMapState,

    saveSettingsFunc,
    openSettings
  } = useSettingsLogic()

  return (
    <ScreenLayout>
      <ScrollView scrollEnabled={!swatchesLoadingState}>
        {/* Блок 1: Формат данных на карте */}
        <View className="m-5 p-5 bg-white rounded-xl shadow-zinc-500 shadow">
          <Text
            className="text-center mb-5 font-roboto font-medium"
            style={{ fontSize: globalFontSize }}
          >
            Формат данных на карте
          </Text>

          <VStack space="2xl">
            <MapPointTime
              value="norm"
              isActive={groupTypeTimeState === 'norm'}
              setActive={setGroupTypeTime}
              theme="white_border"
              text="21:46 (53 мин.)"
            />
            <MapPointTime
              value="full"
              isActive={groupTypeTimeState === 'full'}
              setActive={setGroupTypeTime}
              theme="white_border"
              text="21:46 - 22:16 (53 мин.)"
            />
            <MapPointTime
              value="min"
              isActive={groupTypeTimeState === 'min'}
              setActive={setGroupTypeTime}
              theme="white_border"
              text="53 мин."
            />
          </VStack>
        </View>

        {/* Блок 2: Оформление */}
        <View className="m-5 p-5 mt-0 bg-white rounded-xl shadow-zinc-500 shadow">
          <Text
            className="text-center mb-5 font-roboto font-medium"
            style={{ fontSize: globalFontSize }}
          >
            Оформление
          </Text>

          <VStack space="2xl" className="bg-yellow-50">
            <MapPointTheme
              value="classic"
              isActive={groupTypeThemeState === 'classic'}
              setActive={setGroupTypeTheme}
              theme="classic"
              text="21:46 (53 мин.)"
            />
            <MapPointTheme
              value="transparent"
              isActive={groupTypeThemeState === 'transparent'}
              setActive={setGroupTypeTheme}
              theme="transparent"
              text="21:46 (53 мин.)"
            />
            <MapPointTheme
              value="white"
              isActive={groupTypeThemeState === 'white'}
              setActive={setGroupTypeTheme}
              theme="white"
              text="21:46 (53 мин.)"
            />
            <MapPointTheme
              value="white_border"
              isActive={groupTypeThemeState === 'white_border'}
              setActive={setGroupTypeTheme}
              theme="white_border"
              text="21:46 (53 мин.)"
            />
            <MapPointTheme
              value="black"
              isActive={groupTypeThemeState === 'black'}
              setActive={setGroupTypeTheme}
              theme="black"
              text="21:46 (53 мин.)"
            />
          </VStack>
        </View>

        <View className="m-5 p-5 mt-0 bg-white rounded-xl shadow-zinc-500 shadow">
          <Text
            className="text-center mb-5 font-roboto font-medium"
            style={{ fontSize: globalFontSize }}
          >
            Карта
          </Text>

          <CheckboxGroup
            value={night_mapState}
            onChange={(keys) => {
              setNight_map(keys as ['is_night'] | [])
            }}
            className="mb-3"
          >
            <Checkbox size="lg" value="is_night">
              <CheckboxIndicator>
                <CheckboxIcon as={CheckIcon} />
              </CheckboxIndicator>
              <CheckboxLabel>Темная тема</CheckboxLabel>
            </Checkbox>
          </CheckboxGroup>

          <CheckboxGroup
            value={is_scaleMapState}
            onChange={(keys) => {
              setScale_map(keys as ['is_scaleMap'] | [])
            }}
            className="mb-3"
          >
            <Checkbox size="lg" value="is_scaleMap">
              <CheckboxIndicator>
                <CheckboxIcon as={CheckIcon} />
              </CheckboxIndicator>
              <CheckboxLabel>Ползунок масштабирования карты</CheckboxLabel>
            </Checkbox>
          </CheckboxGroup>

          <CheckboxGroup
            value={centered_mapState}
            onChange={(keys) => {
              setCentered_map(keys as ['is_center'] | [])
            }}
          >
            <Checkbox size="lg" value="is_center">
              <CheckboxIndicator>
                <CheckboxIcon as={CheckIcon} />
              </CheckboxIndicator>
              <CheckboxLabel className='w-3/4'>Центрировать карту при взятии или отмене заказа</CheckboxLabel>
            </Checkbox>
          </CheckboxGroup>
        </View>

        {/* Блок 3: Отмененные заказы */}
        <View className="m-5 p-5 mt-0 bg-white rounded-xl shadow-zinc-500 shadow">
          <Text
            className="text-center mb-5 font-roboto font-medium"
            style={{ fontSize: globalFontSize }}
          >
            Отмененные заказы
          </Text>

          <RadioGroup
            value={type_show_delState}
            onChange={(nextValue) => setType_show_del(nextValue as DelType)}
          >
            <Radio value="full" size="lg" className="mb-3">
              <RadioIndicator>
                <RadioIcon as={CircleIcon} />
              </RadioIndicator>
              <RadioLabel style={{ fontSize: globalFontSize, fontWeight: '500' }}>
                Показывать весь день
              </RadioLabel>
            </Radio>

            <Radio value="min" size="lg" className="mb-3">
              <RadioIndicator>
                <RadioIcon as={CircleIcon} />
              </RadioIndicator>
              <RadioLabel style={{ fontSize: globalFontSize, fontWeight: '500' }}>
                30 минут
              </RadioLabel>
            </Radio>

            <Radio value="max" size="lg">
              <RadioIndicator>
                <RadioIcon as={CircleIcon} />
              </RadioIndicator>
              <RadioLabel style={{ fontSize: globalFontSize, fontWeight: '500' }}>
                2 часа
              </RadioLabel>
            </Radio>
          </RadioGroup>
        </View>

        {/* Блок 5: Размер шрифта */}
        <View className="m-5 p-5 mt-0 pb-7 bg-white rounded-xl shadow-zinc-500 shadow">
          <Text
            className="text-center mb-5 font-roboto font-medium"
            style={{ fontSize: globalFontSize }}
          >
            Размер шрифта ({fontSizeState})
          </Text>

          <View className="flex-row items-center justify-between mb-3">
            <Text style={{ color: '#000', fontSize: 10 }}>Ая</Text>
            <Text style={{ color: '#000', fontSize: fontSizeState }}>Ая</Text>
            <Text style={{ color: '#000', fontSize: 40 }}>Ая</Text>
          </View>

          <Center className="w-full">
            <Slider
              value={fontSizeState}
              onChange={(v) => {
                setSwatchesLoading(true)
                setFontSize(Math.floor(v))
                setTimeout(() => {
                  setSwatchesLoading(false)
                }, 100)
              }}
              size="lg"
              orientation="horizontal"
              minValue={10}
              maxValue={40}
            >
              <SliderTrack>
                <SliderFilledTrack />
              </SliderTrack>
              <SliderThumb />
            </Slider>
          </Center>
        </View>

        {/* Блок 6: Масштаб иконок на карте */}
        <View className="m-5 p-5 mt-0 pb-7 bg-white rounded-xl shadow-zinc-500 shadow">
          <Text
            className="text-center mb-5 font-roboto font-medium"
            style={{ fontSize: globalFontSize }}
          >
            Масштабирование иконок на карте ({mapScaleState})
          </Text>

          <Center className="w-full">
            <Slider
              value={mapScaleState}
              onChange={(v) => {
                setSwatchesLoading(true)
                setMapScale(v)
                setTimeout(() => {
                  setSwatchesLoading(false)
                }, 100)
              }}
              size="lg"
              orientation="horizontal"
              minValue={0.5}
              maxValue={1.3}
              step={0.1}
            >
              <SliderTrack>
                <SliderFilledTrack />
              </SliderTrack>
              <SliderThumb />
            </Slider>
          </Center>
        </View>

        {/* Блок 7: Частота обновления заказов */}
        <View className="m-5 p-5 mt-0 pb-7 bg-white rounded-xl shadow-zinc-500 shadow">
          <Text
            className="text-center mb-5 font-roboto font-medium"
            style={{ fontSize: globalFontSize }}
          >
            Частота обновления заказов
          </Text>

          <RadioGroup
            value={String(update_intervalState)}
            onChange={(nextValue) => setUpdate_interval(Number(nextValue))}
          >
            <Radio value="0" size="lg" className="mb-3">
              <RadioIndicator>
                <RadioIcon as={CircleIcon} />
              </RadioIndicator>
              <RadioLabel style={{ fontSize: globalFontSize, fontWeight: '500' }}>
                Не обновлять
              </RadioLabel>
            </Radio>

            <Radio value="10" size="lg" className="mb-3">
              <RadioIndicator>
                <RadioIcon as={CircleIcon} />
              </RadioIndicator>
              <RadioLabel style={{ fontSize: globalFontSize, fontWeight: '500' }}>
                Каждые 10 секунд
              </RadioLabel>
            </Radio>

            <Radio value="30" size="lg" className="mb-3">
              <RadioIndicator>
                <RadioIcon as={CircleIcon} />
              </RadioIndicator>
              <RadioLabel style={{ fontSize: globalFontSize, fontWeight: '500' }}>
                Каждые 30 секунд
              </RadioLabel>
            </Radio>

            <Radio value="60" size="lg" className="mb-3">
              <RadioIndicator>
                <RadioIcon as={CircleIcon} />
              </RadioIndicator>
              <RadioLabel style={{ fontSize: globalFontSize, fontWeight: '500' }}>
                Каждые 60 секунд
              </RadioLabel>
            </Radio>

            <Radio value="120" size="lg">
              <RadioIndicator>
                <RadioIcon as={CircleIcon} />
              </RadioIndicator>
              <RadioLabel style={{ fontSize: globalFontSize, fontWeight: '500' }}>
                Каждые 120 секунд
              </RadioLabel>
            </Radio>
          </RadioGroup>
        </View>

        {/* Блок 8: Цвет на карте */}
        <View className="m-5 p-5 mt-0 pb-7 bg-white rounded-xl shadow-zinc-500 shadow">
          <Text
            className="text-center mb-5 font-roboto font-medium"
            style={{ fontSize: globalFontSize }}
          >
            Цвет на карте
          </Text>

          <ColorPicker
            color={colorState}
            onColorChangeComplete={(clr) => {
              setColor(clr)
              setSwatchesLoading(false)
            }}
            thumbSize={40}
            sliderSize={40}
            noSnap
            row={false}
            swatches
            onInteractionStart={() => setSwatchesLoading(true)}
          />
        </View>

        {/* Блок 9: Открыть настройки приложения */}
        <View className="m-5 p-5 mt-0 bg-white rounded-xl shadow-zinc-500 shadow">
          <Button
            onPress={openSettings}
            variant="outline"
            className="rounded-lg border-gray-200 justify-center items-center h-auto"
            style={{ backgroundColor: '#b5b5b5' }}
          >
            <ButtonText className="p-3 color-white text-center" style={{ fontSize: globalFontSize }}>
              Открыть настройки приложения
            </ButtonText>
          </Button>
        </View>

        {/* Блок 10: Сохранить */}
        <View className="m-5 p-5 mt-0 mb-10 bg-white rounded-xl shadow-zinc-500 shadow">
          <Button
            onPress={saveSettingsFunc}
            variant="outline"
            className="rounded-lg border-gray-200 justify-center items-center h-auto"
            style={{ backgroundColor: '#44944a' }}
          >
            <ButtonText className="p-3 color-white" style={{ fontSize: globalFontSize }}>
              Сохранить
            </ButtonText>
          </Button>
        </View>
      </ScrollView>
    </ScreenLayout>
  )
}