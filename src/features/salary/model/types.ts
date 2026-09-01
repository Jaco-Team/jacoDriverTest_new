export type ActivePricePicker = 'start' | 'end' | null

export interface PriceMetricRow {
  label: string
  value: string
  description?: string
  emphasize?: boolean
  hideDivider?: boolean
}

export interface TextDescriptionProps {
  text: string
  value: string
  title?: string
  emphasize?: boolean
  hideDivider?: boolean
  globalFontSize: number
}

export interface TextPopoverProps {
  Main: React.ReactNode
  title: string
  globalFontSize: number
}

export interface PriceDatePickerSheetProps {
  isOpen: boolean
  title: string
  value: string
  minDate: string
  maxDate: string
  onClose: () => void
  onSelect: (date: string) => void
}
