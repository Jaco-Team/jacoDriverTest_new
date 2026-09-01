interface OrderNeedTimeFields {
  need_time?: unknown
  time_start_mini?: unknown
  unix_time_to_client?: unknown
}

function addMinutes(time: string, minutes: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!match) return ''

  const hours = Number(match[1])
  const currentMinutes = Number(match[2])
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(currentMinutes) ||
    hours < 0 ||
    hours > 23 ||
    currentMinutes < 0 ||
    currentMinutes > 59
  ) {
    return ''
  }

  const minutesInDay = 24 * 60
  const result = (hours * 60 + currentMinutes + minutes) % minutesInDay
  const resultHours = Math.floor(result / 60)
  const resultMinutes = result % 60

  return `${String(resultHours).padStart(2, '0')}:${String(resultMinutes).padStart(2, '0')}`
}

export function getOrderNeedTime(item: OrderNeedTimeFields): string {
  const needTime = String(item.need_time ?? '').trim()
  if (needTime) return needTime

  const startTime = String(item.time_start_mini ?? '').trim()
  const clientTimeParts = String(item.unix_time_to_client ?? '')
    .split('-')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
  const maxClientMinutes = clientTimeParts.at(-1)

  if (!startTime || maxClientMinutes === undefined) return ''

  const endTime = addMinutes(startTime, maxClientMinutes)
  return endTime ? `${startTime} - ${endTime}` : ''
}
