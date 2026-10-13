import type {SettingsPoint} from '@/shared/store/SettingsStoreType'

const DEMO_LOGIN = '79990000001'
const DEMO_POINT_ID = 1

function toPointId(value: unknown): number | null {
  const pointId = Number(value)
  return Number.isInteger(pointId) && pointId > 0 ? pointId : null
}

export function resolveRecommendationPointId({
  selectedPointId,
  userPointId,
  points,
  login,
}: {
  selectedPointId: number | null
  userPointId: number | null
  points: SettingsPoint[]
  login: string | null
}): number | null {
  return toPointId(selectedPointId)
    ?? toPointId(userPointId)
    ?? toPointId(points[0]?.id)
    ?? (login === DEMO_LOGIN ? DEMO_POINT_ID : null)
}
