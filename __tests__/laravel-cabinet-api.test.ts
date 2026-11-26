import {fetchLaravelCabinet, resolveCabinetPhotoUrl} from '@/shared/api/laravel/cabinet'
import {laravelHttp} from '@/shared/api/laravel/connector'

jest.mock('@/shared/api/laravel/config', () => ({
  laravelApiConfig: {
    mode: 'local',
    origin: 'http://localhost:8080',
    timeoutMs: 45_000,
  },
}))

const mockApiConfig = jest.requireMock('@/shared/api/laravel/config').laravelApiConfig as {
  mode: 'local' | 'production'
}

afterEach(() => {
  jest.restoreAllMocks()
  mockApiConfig.mode = 'local'
})

it('читает ЛК с Bearer-токеном и поддерживает отмену HTTP-запроса', async () => {
  const data = {workplace_name: 'Ленинградская 47'}
  const get = jest.spyOn(laravelHttp, 'get').mockResolvedValue({data})
  const {signal} = new AbortController()

  await expect(fetchLaravelCabinet('test-token', signal)).resolves.toBe(data)
  expect(get).toHaveBeenCalledWith('/api/v1/cabinet', {
    headers: {Authorization: 'Bearer test-token'},
    signal,
  })
})

it('разрешает HTTPS-фото и строго заданный локальный путь тестового фото', () => {
  expect(resolveCabinetPhotoUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg')
  expect(resolveCabinetPhotoUrl('/lk-fixtures/LK-TEST-2563.png')).toBe('http://localhost:8080/lk-fixtures/LK-TEST-2563.png')
  expect(resolveCabinetPhotoUrl('/lk-fixtures/../secret.png')).toBeNull()
  mockApiConfig.mode = 'production'
  expect(resolveCabinetPhotoUrl('/lk-fixtures/LK-TEST-2563.png')).toBeNull()
})
