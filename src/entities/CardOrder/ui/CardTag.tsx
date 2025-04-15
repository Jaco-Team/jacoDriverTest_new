import React from "react"

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box"

import { CardTagType } from "@/entities/CardOrder/model/types"

export const CardTag: React.FC<CardTagType> = ({ text, color, count, globalFontSize }) => (
  <Box className={`bg-primary-${color} pt-1 pb-1 pl-5 pr-5 rounded-full mr-2 w-auto`}>
    <HStack>
      <Text className="text-typography-0 text-center font-normal" style={{ fontSize: globalFontSize-2 }}>{text}</Text>
      {count && <Text className="text-typography-0 text-center font-normal" style={{ fontSize: globalFontSize-2 }}> x{count}</Text>}
    </HStack>
  </Box>
);