import { Status } from '@/shared/types/globalTypes'
import type { LaravelAuthUser } from '@/shared/api/laravel/auth'

export type CheckTokenResponse = {
  st: Status;
}

/** Результат подготовки входа через SSO: адрес для браузера или причина отказа. */
export type SsoLoginStart =
  | {st: true; url: string}
  | {st: false; text: string};

export interface StatusTextType {
  st: Status;
  text: string;
  captcha_required?: boolean;
};

export interface LoginTypes {
  is_load: boolean,
  is_loadToken: boolean,

  authData: object,
  currentUser: LaravelAuthUser | null,

  initialPage: string,
  loginErr: string,

  wallpaper_btn: boolean,
  formAuth: boolean,
  
  auth: (login: string, pwd: string, captchaToken?: string) => Promise<StatusTextType>,
  prepareSsoLogin: () => Promise<SsoLoginStart>,
  authWithSsoCode: (loginCode: string) => Promise<StatusTextType>,
  check_token: () => Promise<Status>,
  logogout: () => Promise<void>,
}
