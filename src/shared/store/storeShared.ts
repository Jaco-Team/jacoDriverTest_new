// Общие константы и счётчики сторов без зависимостей от других сторов:
// модуль безопасно импортировать при инициализации любого стора.

export const SELECTED_POINT_STORAGE_KEY = 'selected_driver_point_id';

export const ORDER_STATUS_FILTER_OPTIONS = [
  {id: 1, text: 'В очереди'},
  {id: 2, text: 'Готовится'},
  {id: 4, text: 'На сборке'},
  {id: 3, text: 'Собран'},
];

let settingsRevision = 0;

export function getSettingsRevision(): number {
  return settingsRevision;
}

export function bumpSettingsRevision(): void {
  settingsRevision += 1;
}

export function getAllOrderStatusFilterIds(): string[] {
  return ORDER_STATUS_FILTER_OPTIONS.map(item => String(item.id));
}
