import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import {
  Popover,
  PopoverBackdrop,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
} from '@/components/ui/popover'

import { TextPopoverProps } from '../model/types'

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
          <TouchableOpacity {...triggerProps}>
            {Main}
          </TouchableOpacity>
        )
      }}
    >
      <PopoverBackdrop />
      <PopoverContent className="w-3/4">
        <PopoverArrow />
        <PopoverBody>
          <Text style={{ fontSize: globalFontSize }}>{title}</Text>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}