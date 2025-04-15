import React, { useState } from "react"

import {TouchableOpacity} from 'react-native';

import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";

import {
  Popover,
  PopoverBackdrop,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
} from "@/components/ui/popover"

import { CardTagPopoverType } from "@/entities/CardOrder/model/types"
import { CardTag } from "@/entities/CardOrder/ui/CardTag"

export const CardTagPopover: React.FC<CardTagPopoverType> = ({ text, color, count, array, globalFontSize }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Popover
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onOpen={() => setIsOpen(true)}
      placement="bottom"
      size="sm"
      className="shadow-zinc-500 shadow"
      trigger={(triggerProps) => (
        <TouchableOpacity {...triggerProps}>
          <CardTag text={text} color={color} count={count} globalFontSize={globalFontSize} />
        </TouchableOpacity>
      )}
    >
      <PopoverBackdrop />
      <PopoverContent>
        <PopoverArrow />
        <PopoverBody>
          <VStack>
            {array.map((drink, idx) => (
              <Text className="text-black font-normal" key={idx} style={{ paddingBottom: idx + 1 === array.length ? 0 : 5, fontSize: globalFontSize }}>
                {drink.names}
              </Text>
            ))}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};