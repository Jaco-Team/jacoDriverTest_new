import type {Theme} from '@/shared/types/globalTypes'

export function resolveMarkerTheme(theme: Theme, isDark: boolean): Theme {
  if (theme === 'transparent' || theme === 'transparent_white') {
    return isDark ? 'transparent_white' : 'transparent'
  }

  return theme
}
