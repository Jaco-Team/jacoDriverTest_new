import { Status } from '@/shared/types/globalTypes'
import type { LaravelAuthUser } from '@/shared/api/laravel/auth'

export type CheckTokenResponse = {
  st: Status;
}

export type LoginResponse = {
  st: Status;
  text?: string;
  token?: string;
  captcha_required?: boolean;
}

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
  
  sendSMS: (login: string, pwd: string, captchaToken?: string) => Promise<StatusTextType>,
  sendCode: (login: string, code: string, pwd: string) => Promise<StatusTextType>,
  auth: (login: string, pwd: string, captchaToken?: string) => Promise<StatusTextType>,
  authWithSsoCode: (loginCode: string) => Promise<StatusTextType>,
  check_token: () => Promise<Status>,
  logogout: () => Promise<void>,
}
