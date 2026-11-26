import {laravelApiConfig} from './config'
import {bearerHeaders, laravelHttp} from './connector'
import {laravelApiRoutes} from './routes'

export interface CabinetHealthBook {
  status: 'valid' | 'expiring' | 'expired' | 'missing'
  valid_until: string | null
  items?: {type: number; name: string; valid_until: string | null}[]
}

export interface CabinetPromo {
  id: number
  code: string
  description: string
  conditions: string
  valid_until: string | null
  time_from: string | null
  time_to: string | null
  uses_left: number
}

export interface CabinetData {
  photo_url: string | null
  appointment_name: string | null
  workplace_name: string | null
  registration_date: string | null
  experience_months: number | null
  health_book: CabinetHealthBook | null
  instructions: {id: number; name: string; url: string | null}[]
  issued_clothes: {id: number; name: string; issued_on: string | null}[]
  promos: CabinetPromo[]
  unavailable: string[]
}

export async function fetchLaravelCabinet(token: string, signal: AbortSignal): Promise<CabinetData> {
  const {data} = await laravelHttp.get<CabinetData>(laravelApiRoutes.cabinet, {
    headers: bearerHeaders(token),
    signal,
  })
  return data
}

export function resolveCabinetPhotoUrl(value?: string | null): string | null {
  if (!value) return null
  if (/^https:\/\//i.test(value)) return value
  return laravelApiConfig.mode === 'local' && /^\/lk-fixtures\/LK-TEST-\d+\.png$/.test(value)
    ? laravelApiConfig.origin + value
    : null
}
