import queryString from 'query-string';
import axios from 'axios';

type ApiResponse<T = any> = {
  st: boolean;
  text: string;
  data?: T;
};

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

export async function api<T>(module: string = '', data: Record<string, any> = {}): Promise<ApiResponse<T>> {
//export async function api<T>(module: string = '', data: Record<string, any> = {}): Promise<T> {
  const urlApi = 'https://api.jacochef.ru/driver/public/index.php/';

  try {
    const response = await axios.post(urlApi + module, queryString.stringify(data));

    if (typeof response.data === 'string') {
      return { st: false, text: response.data };
    }

    //return response.data as T; // Возвращаем только `data`
    return { st: response.data?.st ?? true, text: response.data?.text ?? '', data: response.data as T }; // Успешный ответ
  } catch (error: any) {
    //throw new Error(error?.message || "Произошла неизвестная ошибка");
    return { st: false, text: error?.message || "Произошла неизвестная ошибка" };
  }
}