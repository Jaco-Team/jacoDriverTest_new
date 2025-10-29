import React from "react"

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

import { PdEtKvProps } from "@/entities/CardOrder/model/types"

export const PdEtKv: React.FC<PdEtKvProps> = ({ item, textStyle }) => {
  // Собираем элементы для отображения
  const displayItems = [
    { key: 'pd', label: 'Пд', value: item.pd },
    { key: 'et', label: 'Эт', value: item.et },
    { key: 'kv', label: 'Кв', value: item.kv },
  ].filter(({ value }) => value !== '0' && value !== '');

  return (
    <HStack className="pb-3" testID="pdetkv">
      {displayItems.map((el, index) => (
        <React.Fragment key={el.key}>
          {index !== 0 && (
            <Text style={textStyle} className="font-bold text-black" testID="pdetkv-sep">
              ,{' '}
            </Text>
          )}
          <Text style={textStyle} testID={`pdetkv-${el.key}`}>
            <Text style={textStyle} className="font-bold text-black" testID={`pdetkv-${el.key}-label`}>
              {el.label}:{' '}
            </Text>
            <Text style={textStyle} className="font-normal text-black" testID={`pdetkv-${el.key}-value`}>
              {el.value}
            </Text>
          </Text>
        </React.Fragment>
      ))}
    </HStack>
  );
};
