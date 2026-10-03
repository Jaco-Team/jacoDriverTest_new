import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  APP_THEME_STORAGE_KEY,
  migrateAppThemeFromNightMap,
  resetAppThemeHydrationForTests,
  resolveAppColorScheme,
  useAppThemeStore,
} from '@/shared/theme/AppThemeProvider'

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>

function resetThemeStore(): void {
  resetAppThemeHydrationForTests()
  useAppThemeStore.setState({
    preference: 'system',
    previewPreference: null,
    ownerKey: null,
    hydrated: false,
    hasStoredPreference: false,
  })
}

describe('тема приложения', () => {
  beforeEach(() => {
    resetThemeStore()
    storage.getItem.mockResolvedValue('')
    storage.setItem.mockResolvedValue(undefined)
  })

  it('по умолчанию следует системной теме', () => {
    expect(resolveAppColorScheme('system', 'light')).toBe('light')
    expect(resolveAppColorScheme('system', 'dark')).toBe('dark')
    expect(resolveAppColorScheme('light', 'dark')).toBe('light')
    expect(resolveAppColorScheme('dark', 'light')).toBe('dark')
  })

  it('восстанавливает сохранённый выбор темы', async () => {
    storage.getItem.mockResolvedValueOnce('dark')

    await useAppThemeStore.getState().hydrate()

    expect(storage.getItem).toHaveBeenCalledWith(APP_THEME_STORAGE_KEY)
    expect(useAppThemeStore.getState()).toMatchObject({
      preference: 'dark',
      hydrated: true,
      hasStoredPreference: true,
    })
  })

  it('сохраняет новый выбор', async () => {
    await useAppThemeStore.getState().setPreference('light')

    expect(useAppThemeStore.getState().preference).toBe('light')
    expect(storage.setItem).toHaveBeenCalledWith(APP_THEME_STORAGE_KEY, 'light')
  })

  it('показывает выбранную тему до сохранения и возвращает сохранённую при уходе', async () => {
    await useAppThemeStore.getState().setPreference('light')
    storage.setItem.mockClear()

    useAppThemeStore.getState().setPreviewPreference('dark')

    expect(useAppThemeStore.getState().previewPreference).toBe('dark')
    expect(useAppThemeStore.getState().preference).toBe('light')
    expect(storage.setItem).not.toHaveBeenCalled()

    useAppThemeStore.getState().clearPreviewPreference()

    expect(useAppThemeStore.getState().previewPreference).toBeNull()
    expect(useAppThemeStore.getState().preference).toBe('light')
  })

  it('переносит старую включённую тёмную карту только без нового выбора', async () => {
    await migrateAppThemeFromNightMap(1)

    expect(useAppThemeStore.getState().preference).toBe('dark')

    resetThemeStore()
    storage.getItem.mockResolvedValueOnce('light')
    await migrateAppThemeFromNightMap(1)

    expect(useAppThemeStore.getState().preference).toBe('light')
  })

  it('не принимает серверный ноль за явный выбор светлой темы', async () => {
    await migrateAppThemeFromNightMap(0)

    expect(useAppThemeStore.getState()).toMatchObject({
      preference: 'system',
      hasStoredPreference: false,
    })
  })

  it('хранит предпочтение отдельно для аккаунта и принимает сервер как источник', async () => {
    await useAppThemeStore.getState().hydrateForOwner('driver-1')
    await useAppThemeStore.getState().setPreference('dark')
    expect(storage.setItem).toHaveBeenCalledWith(`${APP_THEME_STORAGE_KEY}:driver-1`, 'dark')

    await useAppThemeStore.getState().applyServerPreference('light')
    expect(useAppThemeStore.getState().preference).toBe('light')

    await useAppThemeStore.getState().hydrateForOwner('driver-2')
    expect(useAppThemeStore.getState().preference).toBe('system')
  })

  it('после выхода возвращает экран входа к системной теме', async () => {
    await useAppThemeStore.getState().hydrateForOwner('driver-1')
    await useAppThemeStore.getState().setPreference('dark')

    useAppThemeStore.getState().clearOwner()

    expect(useAppThemeStore.getState().preference).toBe('system')
    expect(resolveAppColorScheme(useAppThemeStore.getState().preference, 'light')).toBe('light')
    expect(resolveAppColorScheme(useAppThemeStore.getState().preference, 'dark')).toBe('dark')
  })
})
