import React from "react"

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

import { PdEtKvProps } from "@/entities/CardOrder/model/types"

export const PdEtKv: React.FC<PdEtKvProps> = ({ item, textStyle }) => {
  // Собираем элементы для отображения
  const displayItems = [
    { label: 'Пд', value: item.pd },
    { label: 'Эт', value: item.et },
    { label: 'Кв', value: item.kv },
  ].filter(({ value }) => value !== '0' && value !== '');

  return (
    <HStack className="pb-3">
      {displayItems.map((el, index) => (
        <React.Fragment key={el.label}>
          {index !== 0 && (
            <Text style={textStyle} className="font-bold text-black">
              ,{' '}
            </Text>
          )}
          <Text style={textStyle}>
            <Text style={textStyle} className="font-bold text-black">
              {el.label}:{' '}
            </Text>
            <Text style={textStyle} className="font-normal text-black">
              {el.value}
            </Text>
          </Text>
        </React.Fragment>
      ))}
    </HStack>
  );
};