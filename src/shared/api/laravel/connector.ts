import axios from 'axios'

import { laravelApiConfig } from './config'

export const laravelHttp = axios.create({
  baseURL: laravelApiConfig.origin,
  timeout: laravelApiConfig.timeoutMs,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

export function bearerHeaders(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` }
}
