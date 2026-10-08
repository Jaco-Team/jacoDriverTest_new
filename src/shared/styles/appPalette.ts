export const lightAppPalette = {
  brand: '#CC0033',
  brandHeader: '#CC0033',
  brandDark: '#A6002A',
  brandDeep: '#7A001F',
  brandSoft: 'rgba(204, 0, 51, 0.08)',
  brandSoftStrong: 'rgba(204, 0, 51, 0.14)',
  primary: '#42627D',
  primaryDark: '#2F465B',
  primaryDeep: '#1F2B36',
  surface: '#F4F7FA',
  surfaceAlt: '#E9EEF3',
  surfaceRaised: '#FFFFFF',
  surfacePressed: '#EEF2F5',
  disabledSurface: '#E0E0E0',
  disabledBorder: '#C9CDD1',
  disabledText: '#9E9E9E',
  soft: 'rgba(66, 98, 125, 0.08)',
  softStrong: 'rgba(66, 98, 125, 0.14)',
  border: 'rgba(66, 98, 125, 0.16)',
  text: '#1F2D38',
  textMuted: '#6B7883',
  shadowSoft: 'rgba(17, 27, 36, 0.08)',
  shadow: 'rgba(17, 27, 36, 0.12)',
  shadowStrong: 'rgba(17, 27, 36, 0.18)',
  overlay: 'rgba(17, 27, 36, 0.42)',
  success: '#22A33A',
  dangerSurface: '#FFF6F7',
  dangerText: '#8F0024',
  alertErrorSurface: '#F7F0EF',
  alertErrorText: '#462C27',
  alertErrorIcon: '#9C4A3D',
} as const;

export const darkAppPalette = {
  brand: '#B52A48',
  brandHeader: '#8A263C',
  brandDark: '#9A213D',
  brandDeep: '#6F182D',
  brandSoft: 'rgba(213, 54, 86, 0.14)',
  brandSoftStrong: 'rgba(213, 54, 86, 0.24)',
  primary: '#7E9BB3',
  primaryDark: '#66849D',
  primaryDeep: '#0A0F14',
  surface: '#080C10',
  surfaceAlt: '#111820',
  surfaceRaised: '#161F28',
  surfacePressed: '#202C37',
  disabledSurface: '#353A40',
  disabledBorder: '#4B5158',
  disabledText: '#9299A0',
  soft: 'rgba(142, 169, 191, 0.10)',
  softStrong: 'rgba(142, 169, 191, 0.20)',
  border: 'rgba(158, 181, 199, 0.24)',
  text: '#F2F5F7',
  textMuted: '#96A3AE',
  shadowSoft: 'rgba(0, 0, 0, 0.18)',
  shadow: 'rgba(0, 0, 0, 0.30)',
  shadowStrong: 'rgba(0, 0, 0, 0.48)',
  overlay: 'rgba(0, 0, 0, 0.64)',
  success: '#45C264',
  dangerSurface: '#2A151C',
  dangerText: '#FF91A8',
  alertErrorSurface: '#110A09',
  alertErrorText: '#DFC5C0',
  alertErrorIcon: '#9C4A3D',
} as const;

export type AppPalette = {
  [Key in keyof typeof lightAppPalette]: string;
};

export const appPalettes: Record<'light' | 'dark', AppPalette> = {
  light: lightAppPalette,
  dark: darkAppPalette,
};

// Совместимость для компонентов, которые ещё используют статическую светлую
// палитру. Новые и переведённые на темы компоненты получают цвета через
// useAppTheme().
export const appPalette = lightAppPalette;
