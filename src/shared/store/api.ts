// import queryString from 'query-string';
// import axios from 'axios';

// type ApiResponse<T = any> = {
//   st: boolean;
//   text: string;
//   data?: T;
// };

/*export function api(module: string = '', data: Record<string, any> = {}): Promise<ApiResponse> {
  const urlApi = 'https://api.jacochef.ru/driver/public/index.php/';

  return axios.post(urlApi + module, queryString.stringify(data))
    .then((response) => {
      if (typeof response.data === 'string') {
        return { st: false, text: response.data };
      }
      return { st: true, text: '', data: response.data };
    })
    .catch((error) => {
      if (error.code === "ERR_NETWORK") {
        //return { st: false, text: "Network error. Please try again." };
      }
      return { st: false, text: error.message || "An unknown error occurred." };
    });
}*/

// export async function api<T>(module: string = '', data: Record<string, any> = {}): Promise<ApiResponse<T>> {
// //export async function api<T>(module: string = '', data: Record<string, any> = {}): Promise<T> {
//   const urlApi = 'https://api.jacochef.ru/driver/public/index.php/';

//   try {
//     const response = await axios.post(urlApi + module, queryString.stringify(data));

//     if (typeof response.data === 'string') {
//       return { st: false, text: response.data };
//     }

//     //return response.data as T; // Возвращаем только `data`
//     return { st: response.data?.st ?? true, text: response.data?.text ?? '', data: response.data as T }; // Успешный ответ
//   } catch (error: any) {
//     //throw new Error(error?.message || "Произошла неизвестная ошибка");
//     return { st: false, text: error?.message || "Произошла неизвестная ошибка" };
//   }
// }

import queryString from 'query-string';
import axios from 'axios';

export type ApiResponse<T = any> = { st: boolean; text: string; data?: T };

// режим моков только для модуля "orders"
type FakeOrdersMode = 'off' | 'actions';

declare global {
  // eslint-disable-next-line no-var
  var __FAKE_ORDERS__: FakeOrdersMode | undefined;
  // eslint-disable-next-line no-var
  var __FAKE_HIDDEN_IDS__: Set<string> | undefined;
}
export {};

const URL_API = 'https://api.jacochef.ru/driver/public/index.php/';
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

function actionsModeOn(module: string) {
  return isDev && module === 'orders' && (globalThis.__FAKE_ORDERS__ ?? 'off') === 'actions';
}

function ensureHiddenSet(): Set<string> {
  if (!globalThis.__FAKE_HIDDEN_IDS__) {
    globalThis.__FAKE_HIDDEN_IDS__ = new Set<string>();
  }
  return globalThis.__FAKE_HIDDEN_IDS__!;
}

function addHiddenId(maybeId: any) {
  const id = maybeId != null ? String(maybeId) : '';
  if (id) ensureHiddenSet().add(id);
}

function filterOrdersPayload(payload: any) {
  const hidden = globalThis.__FAKE_HIDDEN_IDS__;
  if (!hidden || !payload || typeof payload !== 'object') return payload;

  const filterList = (list: any) =>
    Array.isArray(list) ? list.filter((it) => !hidden.has(String(it?.id))) : list;

  // фильтруем возможные массивы заказов (реальный бэк использует их)
  ['orders', 'free_orders', 'my_orders', 'other_orders', 'pred_orders'].forEach((k) => {
    if (payload[k]) payload[k] = filterList(payload[k]);
  });

  return payload;
}

export async function api<T>(module: string = '', data: Record<string, any> = {}): Promise<ApiResponse<T>> {
  // 1) READ-ONLY ДЕЙСТВИЯ: перехватываем action'ы и возращаем успех локально, ничего не отправляя на бэк
  if (actionsModeOn(module)) {
    const type = data?.type;

    if (isDev) {
      // 💡 Dev-маркер: видно в логе, что перехват сработал
      // (в проде сюда не попадём по условию isDev)
      // eslint-disable-next-line no-console
      console.log('[FAKE-ORDERS:PASS]', type);
    }

    // Нажатия: "Взять/Отменить/Завершить"
    if (type === 'actionOrder') {
      addHiddenId(data?.id);
      // имитируем успех, чтобы UI пошёл по «боевой» ветке
      return { st: true, text: '', data: { ok: true, id: String(data?.id), type_action: data?.type_action } as any };
    }

    // Fake-путь: "клиент не вышел на связь"
    if (type === 'checkFakeOrder') {
      addHiddenId(data?.order_id);
      return { st: true, text: '', data: { ok: true, order_id: String(data?.order_id) } as any };
    }
  }

  // 2) ВСЁ ОСТАЛЬНОЕ — РЕАЛЬНЫЙ БЭК
  try {
    const response = await axios.post(URL_API + module, queryString.stringify(data));

    if (typeof response.data === 'string') {
      return { st: false, text: response.data };
    }

    // если включён режим read-only действий — после реального ответа скрываем локально «взятые» заказы
    let payload: any = response.data;
    if (actionsModeOn(module)) {
      payload = filterOrdersPayload(payload);
    }

    return { st: payload?.st ?? true, text: payload?.text ?? '', data: payload as T };
  } catch (error: any) {
    return { st: false, text: error?.message || 'Произошла неизвестная ошибка' };
  }
}





