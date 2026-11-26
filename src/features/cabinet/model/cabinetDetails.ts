import type {CabinetData, CabinetHealthBook, CabinetPromo} from '@/shared/api/laravel/cabinet'
import type {ShowType} from '@/shared/types/globalTypes'

export function formatCabinetDate(date?: string | null): string | null {
  return date?.split('-').reverse().join('.') ?? null
}

function yearLabel(years: number): string {
  const lastTwoDigits = years % 100
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'лет'

  const lastDigit = years % 10
  if (lastDigit === 1) return 'год'
  if (lastDigit >= 2 && lastDigit <= 4) return 'года'
  return 'лет'
}

export function formatExperience(totalMonths?: number | null): string | null {
  if (totalMonths == null) return null
  if (totalMonths === 0) return 'Менее месяца'
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  return [
    years ? years + ' ' + yearLabel(years) : '',
    months ? months + ' мес.' : '',
  ].filter(Boolean).join(' ')
}

export function healthSummary(book: CabinetHealthBook): string {
  const until = formatCabinetDate(book.valid_until)

  switch (book.status) {
    case 'valid':
      return until ? 'Действует до ' + until : 'Действует'
    case 'expiring':
      return until ? 'Истекает ' + until : 'Срок истекает'
    case 'expired':
      return until ? 'Срок истёк ' + until : 'Срок истёк'
    case 'missing':
      return 'Срок не заполнен'
  }
}

export function sortedHealthChecks(items: NonNullable<CabinetHealthBook['items']>) {
  return [...items].sort((left, right) => {
    if (left.valid_until === right.valid_until) return 0
    if (left.valid_until === null) return 1
    if (right.valid_until === null) return -1
    return left.valid_until.localeCompare(right.valid_until)
  })
}

const materialTitles = [
  {title: 'Инструкция курьера', sourceTitles: ['инструкция курьера', 'курьер']},
  {title: 'Общие правила', sourceTitles: ['общие правила']},
]

export function visibleCabinetMaterials(instructions: CabinetData['instructions']) {
  return materialTitles.flatMap(({title, sourceTitles}) => {
    const item = instructions.find(({name}) => sourceTitles.includes(name.trim().toLowerCase()))
    return item ? [{...item, name: title}] : []
  })
}

function formatSamaraDay(now: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Samara', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-')
}

export function formatPromoTiming(promo: CabinetPromo, now = new Date()): string {
  const date = formatCabinetDate(promo.valid_until)
  const validity = date ? (promo.valid_until === formatSamaraDay(now) ? 'сегодня' : 'до ' + date) : ''
  const {time_from: from, time_to: to} = promo
  const alreadyShown = from && to && [promo.conditions, promo.description].some(
    (text) => text.includes(from) && text.includes(to),
  )
  const time = from && to && !alreadyShown ? 'с ' + from + ' до ' + to : ''
  return validity || time ? ['Действует', validity, time].filter(Boolean).join(' ') : ''
}

const markerLabels: Record<ShowType, string> = {
  norm: '18:40 (12 мин.)',
  full: '18:40 - 19:10 (12 мин.)',
  min: '12 мин.',
}

export function cabinetMarkerLabel(format: ShowType): string {
  return markerLabels[format] ?? markerLabels.norm
}
