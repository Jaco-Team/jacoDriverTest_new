export interface TextDescriptionProps {
  text: string
  value: number
  title?: string
  FormatPrice: (num: number) => string
  bottom_devider?: boolean
  globalFontSize: number,
  type: 'count' | 'price'
}

export interface TextPopoverProps {
  Main: React.ReactNode
  title: string
  globalFontSize: number
}