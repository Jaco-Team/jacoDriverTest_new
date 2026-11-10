import { useAppTheme } from '@/shared/theme/AppThemeProvider'

export interface AuthPalette {
  isDark: boolean
  /** Фон основной кнопки, как на странице входа SSO. */
  crimson: string
  /** Цвет текстовых акцентов: ссылки и выбранный способ получения кода. */
  accent: string
  ring: string
  ink: string
  label: string
  muted: string
  border: string
  card: string
  field: string
  error: string
  success: string
  segment: string
  segmentThumb: string
  segmentText: string
  backgroundTop: string
  backgroundBottom: string
}

const LIGHT: AuthPalette = {
  isDark: false,
  crimson: '#A50021',
  accent: '#A50021',
  ring: 'rgba(165, 0, 33, 0.10)',
  ink: '#111827',
  label: '#1F2937',
  muted: '#6B7280',
  border: '#E5E7EB',
  card: '#FFFFFF',
  field: '#FFFFFF',
  error: '#B91C1C',
  success: '#15803D',
  segment: '#F3F3F3',
  segmentThumb: '#FFFFFF',
  segmentText: '#5E5E5E',
  backgroundTop: '#F4F6FA',
  backgroundBottom: '#FFFFFF',
}

/**
 * Цвета входа и восстановления пароля. В светлой теме — те же, что на странице
 * входа SSO и в ШЭФ; в тёмной нейтральные цвета берутся из темы приложения.
 */
export function useAuthPalette(): AuthPalette {
  const { colors, isDark } = useAppTheme()

  if (!isDark) return LIGHT

  return {
    isDark: true,
    crimson: '#A50021',
    accent: '#FF8FA6',
    ring: 'rgba(255, 143, 166, 0.18)',
    ink: colors.text,
    label: colors.text,
    muted: colors.textMuted,
    border: colors.border,
    card: colors.surfaceRaised,
    field: colors.surfaceAlt,
    error: colors.dangerText,
    success: '#4ADE80',
    segment: colors.surfaceAlt,
    segmentThumb: colors.surfaceRaised,
    segmentText: colors.textMuted,
    backgroundTop: colors.surface,
    backgroundBottom: colors.surfaceAlt,
  }
}
