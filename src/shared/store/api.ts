import type { AxiosRequestConfig } from 'axios'

import { bearerHeaders, laravelHttp } from '@/shared/api/laravel/connector'
import { getLaravelApiErrorInfo } from '@/shared/api/laravel/errors'
import { laravelApiRoutes } from '@/shared/api/laravel/routes'
import {
  clearLaravelAuthToken,
  getLaravelAuthToken,
} from '@/shared/lib/laravelAuthTokenStorage'

export type ApiResponse<T = any> = { st: boolean; text: string; data?: T }

type FakeOrdersMode = 'off' | 'actions'

declare global {
  // eslint-disable-next-line no-var
  var __FAKE_ORDERS__: FakeOrdersMode | undefined
  // eslint-disable-next-line no-var
  var __FAKE_HIDDEN_IDS__: Set<string> | undefined
}
export {}

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production'

function actionsModeOn(module: string): boolean {
  return isDev && module === 'orders' && (globalThis.__FAKE_ORDERS__ ?? 'off') === 'actions'
}

function ensureHiddenSet(): Set<string> {
  if (!globalThis.__FAKE_HIDDEN_IDS__) {
    globalThis.__FAKE_HIDDEN_IDS__ = new Set<string>()
  }

  return globalThis.__FAKE_HIDDEN_IDS__
}

function addHiddenId(maybeId: unknown): void {
  const id = maybeId != null ? String(maybeId) : ''
  if (id) ensureHiddenSet().add(id)
}

function filterOrdersPayload(payload: any): any {
  const hidden = globalThis.__FAKE_HIDDEN_IDS__
  if (!hidden || !payload || typeof payload !== 'object') return payload

  const filterList = (list: any) =>
    Array.isArray(list) ? list.filter(item => !hidden.has(String(item?.id))) : list

  ;['orders', 'free_orders', 'my_orders', 'other_orders', 'pred_orders'].forEach(key => {
    if (payload[key]) payload[key] = filterList(payload[key])
  })

  return payload
}

function withoutInternalFields(data: Record<string, any>): Record<string, any> {
  const { token: _token, type: _type, ...payload } = data
  return payload
}

function deletedOrderPeriod(value: unknown): unknown {
  if (value === 'min') return 30
  if (value === 'max') return 120
  if (value === 'full') return 1440
  return value
}

type LaravelRequest = {
  method: 'get' | 'post'
  path: string
  payload?: Record<string, any>
  requiresAuth?: boolean
  selectData?: (payload: any) => any
}

function resolveLaravelRequest(module: string, data: Record<string, any>): LaravelRequest {
  const type = String(data.type ?? '')
  const payload = withoutInternalFields(data)

  if (module === 'auth' && type === 'get_sms') {
    return {
      method: 'post',
      path: laravelApiRoutes.auth.passwordRecoverySendCode,
      payload: {
        login: data.login,
        password: data.pwd,
        ...(data.captcha_token ? { captcha_token: data.captcha_token } : {}),
      },
      requiresAuth: false,
    }
  }

  if (module === 'auth' && type === 'check_code') {
    return {
      method: 'post',
      path: laravelApiRoutes.auth.passwordRecoveryConfirmCode,
      payload: { login: data.login, code: data.code },
      requiresAuth: false,
    }
  }

  if (module === 'price' && (type === 'get_my_price' || type === 'get_my_price_between')) {
    return {
      method: 'post',
      path: laravelApiRoutes.price.between,
      payload: {
        dateStart: type === 'get_my_price' ? data.date : data.dateStart,
        dateEnd: type === 'get_my_price' ? data.date : data.dateEnd,
        ...(data.point_id ? { point_id: data.point_id } : {}),
      },
    }
  }

  if (module === 'graph' && type === 'get_my_graph') {
    return {
      method: 'post',
      path: laravelApiRoutes.graph.root,
      payload,
      selectData: response => {
        const months = response?.mounth ?? response?.month ?? []

        return {
          ...response,
          mounth: Array.isArray(months)
            ? months.map(item => ({
              ...item,
              mounth: item?.mounth ?? item?.month ?? '',
            }))
            : [],
        }
      },
    }
  }

  if (module === 'graph' && type === 'save_false_cash_orders') {
    return { method: 'post', path: laravelApiRoutes.graph.orderAppeals, payload }
  }

  if (module === 'graph' && type === 'save_false_cash_cum') {
    return { method: 'post', path: laravelApiRoutes.graph.cameraAppeals, payload }
  }

  if (module === 'stat_time' && type === 'show_data') {
    return { method: 'post', path: laravelApiRoutes.statistics.showData, payload }
  }

  if (module === 'orders' && type === 'get_my_avg_time') {
    return { method: 'post', path: laravelApiRoutes.settings.avgTime, payload }
  }

  if (module === 'orders' && type === 'get_orders') {
    return { method: 'post', path: laravelApiRoutes.orders.getOrders, payload }
  }

  if (module === 'orders' && type === 'actionOrder') {
    return { method: 'post', path: laravelApiRoutes.orders.actionOrder, payload: { ...payload, type } }
  }

  if (module === 'orders' && type === 'checkFakeOrder') {
    return { method: 'post', path: laravelApiRoutes.orders.checkFakeOrder, payload: { ...payload, type } }
  }

  if (module === 'orders' && type === 'get_pay_qr') {
    return { method: 'post', path: laravelApiRoutes.orders.getPayQr, payload }
  }

  if (module === 'orders' && type === 'check_pay_order') {
    return { method: 'post', path: laravelApiRoutes.orders.checkPayOrder, payload }
  }

  if (module === 'orders' && type === 'hide_del_orders') {
    return {
      method: 'post',
      path: laravelApiRoutes.orders.hideDeletedOrders,
      payload: {
        ...payload,
        id_list: Array.isArray(payload.id_list)
          ? JSON.stringify(payload.id_list)
          : payload.id_list,
      },
    }
  }

  if (module === 'settings' && type === 'getMySetting') {
    return {
      method: 'get',
      path: laravelApiRoutes.settings.get,
      selectData: response => ({
        ...(response?.settings ?? {}),
        all_points: response?.all_points ?? [],
      }),
    }
  }

  if (module === 'settings' && type === 'saveMySetting') {
    return {
      method: 'post',
      path: laravelApiRoutes.settings.save,
      payload: { ...payload, type_show_del: deletedOrderPeriod(payload.type_show_del) },
      selectData: response => response?.settings ?? response,
    }
  }

  if (module === 'settings' && type === 'get_point_phone') {
    return {
      method: 'post',
      path: laravelApiRoutes.settings.pointPhones,
      payload,
      selectData: response => ({
        ...response,
        phone: response?.phone
          ? {
            ...response.phone,
            phone_center: response.phone.phone_center ?? response.phone.phone_city ?? '',
          }
          : null,
      }),
    }
  }

  if (module === 'settings' && type === 'save_my_pos') {
    return { method: 'post', path: laravelApiRoutes.settings.savePosition, payload }
  }

  throw new Error(`Неизвестная операция Laravel API: ${module}/${type || 'без типа'}`)
}

export async function api<T>(
  module: string = '',
  data: Record<string, any> = {},
): Promise<ApiResponse<T>> {
  if (actionsModeOn(module)) {
    const type = data?.type

    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[FAKE-ORDERS:PASS]', type)
    }

    if (type === 'actionOrder') {
      addHiddenId(data?.id)
      return {
        st: true,
        text: '',
        data: { ok: true, id: String(data?.id), type_action: data?.type_action } as T,
      }
    }

    if (type === 'checkFakeOrder') {
      addHiddenId(data?.order_id)
      return {
        st: true,
        text: '',
        data: { ok: true, order_id: String(data?.order_id) } as T,
      }
    }
  }

  try {
    const request = resolveLaravelRequest(module, data)
    const token = await getLaravelAuthToken()

    if (request.requiresAuth !== false && !token) {
      return { st: false, text: 'Сессия истекла. Войдите снова.' }
    }

    const config: AxiosRequestConfig = token ? { headers: bearerHeaders(token) } : {}
    const response = request.method === 'get'
      ? await laravelHttp.get(request.path, config)
      : await laravelHttp.post(request.path, request.payload ?? {}, config)

    let payload = request.selectData ? request.selectData(response.data) : response.data
    if (actionsModeOn(module)) payload = filterOrdersPayload(payload)

    const st = response.data?.st ?? response.data?.success ?? true
    const responseText = String(response.data?.text ?? response.data?.message ?? '')

    return { st, text: responseText, data: payload as T }
  } catch (error) {
    const info = getLaravelApiErrorInfo(error)
    if (info.status === 401) {
      await clearLaravelAuthToken().catch(() => undefined)
    }
    return { st: false, text: info.message }
  }
}
