import {
  laravelApiConfig,
  resolveLaravelApiOrigin,
} from '@/shared/api/laravel/config'

describe('Laravel API config', () => {
  it('по умолчанию использует production API даже в test/dev bundle', () => {
    expect(laravelApiConfig.mode).toBe('production')
    expect(laravelApiConfig.origin).toBe('https://apidriver.jacochef.ru')
  })

  it('сохраняет явный local-режим для CAPTCHA и SSO разработки', () => {
    expect(resolveLaravelApiOrigin('local')).toBe('http://localhost:8080')
    expect(resolveLaravelApiOrigin('production')).toBe(
      'https://apidriver.jacochef.ru',
    )
  })
})
