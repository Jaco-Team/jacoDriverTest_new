import React from 'react'
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native'
import {Linking} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'

import type {CabinetData} from '@/shared/api/laravel/cabinet'
import {ConnectivityContext} from '@/shared/lib/connectivityContext'
import type {LaravelAuthUser} from '@/shared/api/laravel/auth'
import {CabinetScreen} from '@/features/cabinet/ui/CabinetScreen'

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockFetchCabinet = jest.fn()
const mockGetSettings = jest.fn()
let mockFocused = true
let mockUser: LaravelAuthUser | null
const mockGlobal = {
  tokenAuth: 'test-token',
  globalFontSize: 16,
  is_need_page_stat: true,
  theme: 'classic',
  mapScale: 1,
}

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: mockGoBack}),
  useIsFocused: () => mockFocused,
}))

jest.mock('@/shared/api/laravel/cabinet', () => ({
  fetchLaravelCabinet: (...args: unknown[]) => mockFetchCabinet(...args),
  resolveCabinetPhotoUrl: (url?: string | null) => url ?? null,
}))

jest.mock('@/shared/store/store', () => ({
  useGlobalStore: (selector: (state: typeof mockGlobal) => unknown) => selector(mockGlobal),
  useLoginStore: (selector: (state: {currentUser: LaravelAuthUser | null}) => unknown) => selector({currentUser: mockUser}),
  useSettingsStore: (selector: (state: object) => unknown) => selector({
    getSettings: mockGetSettings,
    type_data_map: 'full',
    color: '#f200ff',
  }),
}))

jest.mock('lucide-react-native', () => {
  const Icon = () => null
  return {
    Calculator: Icon, CalendarDays: Icon, ChartNoAxesCombined: Icon, Check: Icon,
    ChevronDown: Icon, ChevronRight: Icon, ChevronUp: Icon, CircleAlert: Icon, Copy: Icon,
    ExternalLink: Icon, FileText: Icon, MapPin: Icon, Tag: Icon, UserRound: Icon,
  }
})

const data: CabinetData = {
  photo_url: null,
  appointment_name: 'Курьер',
  workplace_name: 'Тольятти, Ленинградская 47',
  registration_date: '2018-02-20',
  experience_months: 105,
  health_book: {
    status: 'valid',
    valid_until: '2027-09-22',
    items: [
      {type: 2, name: 'Отоларинголог', valid_until: '2028-09-05'},
      {type: 10, name: 'Санитарный минимум', valid_until: '2027-09-22'},
      {type: 9, name: 'Яйц. глист', valid_until: null},
    ],
  },
  instructions: [
    {id: 1, name: 'Курьер', url: 'https://example.com/guide'},
    {id: 2, name: 'Общие правила', url: 'https://example.com/rules'},
    {id: 3, name: 'Курьерское приложение IOS', url: 'https://example.com/ios'},
    {id: 4, name: 'Курьерский сайт', url: 'https://example.com/site'},
  ],
  issued_clothes: [],
  promos: [{
    id: 1,
    code: 'DRIVER-CABINET-TEST',
    description: 'Обед для сотрудников',
    conditions: 'Действует с 11:00 до 19:00.',
    valid_until: '2026-11-25',
    time_from: '11:00',
    time_to: '19:00',
    uses_left: 2,
  }],
  unavailable: [],
}

function cabinet(offline = false) {
  return (
    <ConnectivityContext.Provider value={offline}>
      <CabinetScreen />
    </ConnectivityContext.Provider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFocused = true
  mockUser = {
    user_id: 2563,
    login: null,
    name: 'Тестовый курьер',
    appointment_id: 8,
    city_id: 1,
    point_id: 3,
  }
  mockGlobal.tokenAuth = 'test-token'
  mockGlobal.is_need_page_stat = true
  mockGetSettings.mockReset().mockResolvedValue(undefined)
  mockFetchCabinet.mockReset().mockResolvedValue(data)
})

afterEach(() => {
  jest.restoreAllMocks()
})

it('открывает профиль, допуски и рабочие разделы, копирует действующий код', async () => {
  jest.setSystemTime(new Date('2026-11-24T21:00:00Z'))
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  await render(cabinet())
  expect(await screen.findByText('Тольятти, Ленинградская 47')).toBeTruthy()
  expect(mockFetchCabinet).toHaveBeenCalledWith('test-token', expect.anything())

  await fireEvent.press(screen.getByRole('button', {name: /^Профиль/}))
  expect(screen.getByText('20.02.2018')).toBeTruthy()
  expect(screen.getByText('8 лет 9 мес.')).toBeTruthy()
  const profileDividers = screen.getAllByTestId('cabinet-profile-divider')
  expect(profileDividers).toHaveLength(4)
  for (const divider of profileDividers) expect(divider).toHaveStyle({height: 1})

  await fireEvent.press(screen.getByRole('button', {name: /^Документы и допуски/}))
  expect(screen.getByText('Действует до 22.09.2027')).toBeTruthy()
  expect(screen.getByText('до 22.09.2027')).toHaveStyle({fontWeight: '700'})
  expect(screen.getByText('Не заполнено')).toBeTruthy()
  const examDividers = screen.getAllByTestId('cabinet-exam-divider')
  expect(examDividers).toHaveLength(2)
  for (const divider of examDividers) expect(divider).toHaveStyle({height: 1})
  const materials = screen.getAllByRole('link')
  expect(materials).toHaveLength(2)
  for (const material of materials) {
    expect(material).toHaveStyle({flexDirection: 'row', minHeight: 44, borderWidth: 1})
  }
  await fireEvent.press(screen.getByRole('link', {name: 'Инструкция курьера'}))
  expect(openURL).toHaveBeenCalledWith('https://example.com/guide')

  expect(screen.getByText('Действует сегодня')).toBeTruthy()
  const copyButton = screen.getByRole('button', {name: 'Скопировать промокод'})
  expect(copyButton).toHaveStyle({width: 44, height: 44, borderWidth: 1})
  await fireEvent.press(copyButton)
  expect(Clipboard.setString).toHaveBeenCalledWith('DRIVER-CABINET-TEST')
  expect(screen.getByRole('button', {name: 'Промокод скопирован'})).toBeTruthy()

  for (const name of ['График работы', 'Расчёт', 'Статистика', 'Настройки']) {
    const button = screen.getByRole('button', {name})
    expect(button).toHaveStyle({flexDirection: 'row', minHeight: 44})
    await fireEvent.press(button)
  }
  expect(mockNavigate.mock.calls).toEqual([['Graph'], ['Price'], ['Statistics'], ['Settings']])
  expect(screen.getByText('18:40 - 19:10 (12 мин.)')).toBeTruthy()
})

it('ждёт настройки и фото, затем показывает кабинет с иконкой при ошибке фото', async () => {
  let finishSettings!: () => void
  mockGetSettings.mockReturnValueOnce(new Promise<void>((resolve) => {finishSettings = resolve}))
  mockFetchCabinet.mockResolvedValueOnce({...data, photo_url: 'https://example.com/photo.jpg'})
  await render(cabinet())

  expect(screen.getByTestId('cabinet-loading')).toBeTruthy()
  expect(screen.queryByTestId('cabinet-photo', {includeHiddenElements: true})).toBeNull()
  await act(async () => finishSettings())

  const image = screen.getByTestId('cabinet-photo', {includeHiddenElements: true})
  expect(screen.getByTestId('cabinet-loading')).toBeTruthy()
  await fireEvent(image, 'error')
  expect(screen.queryByTestId('cabinet-loading')).toBeNull()
  expect(screen.queryByTestId('cabinet-photo')).toBeNull()
  expect(screen.getByText('Тестовый курьер')).toBeTruthy()
})

it('сохраняет заголовки раскрытых разделов без сети и восстанавливает их данные', async () => {
  const view = await render(cabinet())
  expect(await screen.findByText('DRIVER-CABINET-TEST')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', {name: /^Профиль/}))
  await fireEvent.press(screen.getByRole('button', {name: /^Документы и допуски/}))

  await view.rerender(cabinet(true))
  expect(screen.getByText('Тестовый курьер')).toBeTruthy()
  expect(screen.queryByText('DRIVER-CABINET-TEST')).toBeNull()
  expect(screen.queryByText('Тольятти, Ленинградская 47')).toBeNull()
  expect(screen.getByText('Профиль')).toBeTruthy()
  expect(screen.getByText('Документы и допуски')).toBeTruthy()
  expect(screen.queryByText('Дата регистрации')).toBeNull()
  expect(screen.queryByText('Медкнижка')).toBeNull()
  expect(screen.queryByText(/после восстановления связи/)).toBeNull()
  expect(mockFetchCabinet).toHaveBeenCalledTimes(1)

  mockFetchCabinet.mockResolvedValueOnce({...data, promos: []})
  await view.rerender(cabinet())
  expect(await screen.findByText('Дата регистрации')).toBeTruthy()
  expect(screen.getByText('Санитарный минимум')).toBeTruthy()
  expect(screen.queryByText('Промокоды')).toBeNull()
  expect(mockFetchCabinet).toHaveBeenCalledTimes(2)
})

it('отменяет запрос при выходе со страницы и скрывает статистику по общему флагу', async () => {
  mockFetchCabinet.mockReturnValueOnce(new Promise<CabinetData>(() => {}))
  mockGlobal.is_need_page_stat = false
  const view = await render(cabinet())
  const signal = mockFetchCabinet.mock.calls[0][1] as AbortSignal

  mockFocused = false
  await view.rerender(cabinet())
  expect(signal.aborted).toBe(true)
  expect(screen.queryByTestId('cabinet-loading')).toBeNull()

  mockFocused = true
  await view.rerender(cabinet())
  await waitFor(() => expect(screen.getByText('Рабочие разделы')).toBeTruthy())
  expect(screen.queryByRole('button', {name: 'Статистика'})).toBeNull()
})

it('не запрашивает данные, пока нет сессии курьера', async () => {
  mockUser = null
  await render(cabinet())
  expect(mockFetchCabinet).not.toHaveBeenCalled()
  expect(screen.queryByText('Профиль')).toBeNull()
})
