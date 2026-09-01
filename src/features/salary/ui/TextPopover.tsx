import React from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import {
  Popover,
  PopoverBackdrop,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
} from '@/components/ui/popover'

import { TextPopoverProps } from '../model/types'
import { appPalette } from '@/shared/styles/appPalette'

export function TextPopover({ Main, title, globalFontSize }: TextPopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleOpen = () => setIsOpen(true)
  const handleClose = () => setIsOpen(false)

  return (
    <Popover
      isOpen={isOpen}
      onClose={handleClose}
      onOpen={handleOpen}
      placement="bottom"
      size="sm"
      trigger={(triggerProps) => {
        return (
          <TouchableOpacity
            {...triggerProps}
            accessibilityLabel={`Подсказка: ${title}`}
            accessibilityRole="button"
            hitSlop={6}
          >
            {Main}
          </TouchableOpacity>
        )
      }}
    >
      <PopoverBackdrop />
      <PopoverContent style={styles.content}>
        <PopoverArrow />
        <PopoverBody>
          <Text style={[styles.text, { fontSize: globalFontSize }]}>{title}</Text>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}

const styles = StyleSheet.create({
  content: {
    width: '78%',
    borderRadius: 16,
    borderColor: appPalette.border,
    backgroundColor: '#FFFFFF',
  },
  text: {
    color: appPalette.text,
    fontFamily: 'Roboto-Regular',
    lineHeight: 22,
  },
})
