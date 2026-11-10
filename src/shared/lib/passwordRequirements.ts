/** Сервер не принимает пробелы в пароле: убираем их ещё при вводе. */
export function stripPasswordSpaces(value: string): string {
  return value.replaceAll(' ', '')
}
