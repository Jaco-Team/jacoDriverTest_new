// Keep this reset preset aligned with the courier website.
export const DEFAULT_DRIVER_SETTINGS = {
  app_theme: 'system',
  type_data_map: 'norm',
  type_show_del: 'min',
  update_interval: 30,
  action_centered_map: 0,
  is_scaleMap: 0,
  map_hints: 1,
  ai_recommend: 0,
  fontSize: 16,
  theme: 'transparent',
  mapScale: 1,
} as const

export const SETTINGS_RESET_CONFIRMATION =
  'Настройки отображения вернутся к значениям по умолчанию и сразу сохранятся. Несохранённые изменения будут заменены. Выбранное кафе, цвет курьера и скачанные карты сохранятся.'
