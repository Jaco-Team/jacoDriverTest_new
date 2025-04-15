import { Status } from '@/shared/types/globalTypes'

export type CheckTokenResponse = {
  st: Status;
}

export type LoginResponse = {
  st: Status;
  text?: string;
  token?: string;
}

export interface StatusTextType {
  st: Status;
  text: string;
};

export interface LoginTypes {
  is_load: boolean,
  is_loadToken: boolean,

  authData: object,

  initialPage: string,
  loginErr: string,

  wallpaper_btn: boolean,
  formAuth: boolean,
  
  sendSMS: (login: string, pwd: string) => Promise<StatusTextType>,
  sendCode: (login: string, code: string) => Promise<StatusTextType>,
  auth: (login: string, pwd: string) => Promise<StatusTextType>,
  check_token: () => Promise<Status>,
  logogout: () => void,
}