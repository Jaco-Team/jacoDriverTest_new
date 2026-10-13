export interface RecommendationCoordinates {
  lat: number
  lon: number
}

export interface RecommendationVolume {
  pizza: number
  pasta: number
  rolls: number
  drinks: number
}

export interface RecommendationOrderInput {
  id: number
  status: number | null
  is_preorder: boolean
  is_mine: boolean
  ready_at: string | null
  deliver_by: string | null
  remaining_time: string | null
  amount: number | null
  volume: RecommendationVolume
  payment: 'online' | 'cash' | null
  xy: RecommendationCoordinates | null
}

export interface RecommendationLimit {
  current: number | null
  max: number | null
  raw: string
}

export interface OrderRecommendationRequest {
  now: string
  timezone: string
  point_id: number | null
  courier: RecommendationCoordinates | null
  limits: {
    sum: RecommendationLimit
    count: RecommendationLimit
  }
  orders: RecommendationOrderInput[]
}

export interface RecommendedOrder {
  id: number
  seq: number
  reason: string
  pickup_at?: string | null
  deliver_at?: string | null
}

export interface SkippedOrder {
  id: number
  reason: string
}

export interface RecommendationRouteStop {
  id: number | null
  kind: 'start' | 'pickup' | 'delivery'
  seq: number
  eta?: string | null
  lat?: number
  lon?: number
}

export interface RecommendationRoute {
  total_minutes?: number | null
  total_distance_m?: number | null
  external_url?: string | null
  stops: RecommendationRouteStop[]
}

export interface OrderRecommendationResult {
  st: boolean
  code?: string
  text?: string
  title?: string
  summary?: string
  take?: RecommendedOrder[]
  skip?: SkippedOrder[]
  route?: RecommendationRoute | null
  warnings?: string[]
}
