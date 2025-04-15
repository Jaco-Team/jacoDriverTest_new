import React from "react"

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

import { ScrollView } from 'react-native';

import { CardOrderProps } from "@/entities/CardOrder/model/types"

import { CardTagPopover } from "./CardTagPopover";
import { CardTag } from "./CardTag";
import { CommentText } from "./CommentText";
import { PdEtKv } from "./PdEtKv";
import { OrderActions } from "./OrderActions";

export const CardOrderComponent: React.FC<CardOrderProps> = ({ item, FormatPrice, showAlertText, globalFontSize, dialCall, actionButtonOrder, setActiveConfirm }) => {
  const textStyle = { fontSize: globalFontSize };

  return (
    <Card className={"m-5 p-5 mb-0 rounded-xl shadow-zinc-500 shadow "+ (item.is_delete == 1 ? 'bg-red-400' : 'bg-white') }>
      
      <Text className="font-semibold text-black pb-3" style={textStyle}>
        {item.id_text}
      </Text>

      {item.is_delete == 1 && <Text className="font-semibold text-black pb-3" style={textStyle}>Клиент отменил заказ</Text>}
          
      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} className="pb-3">
        {item.count_other > 0 && <CardTag text="Роллы" color="blue" globalFontSize={globalFontSize} />}
        {item.count_pasta > 0 && <CardTag text="Паста" color="purpur" count={item.count_pasta} globalFontSize={globalFontSize} />}
        {item.count_pizza > 0 && <CardTag text="Пицца" color="red" count={item.count_pizza} globalFontSize={globalFontSize} />}
        {item.count_drink > 0 && (
          <CardTagPopover text="Напиток" color="green" count={item.count_drink} array={item.drink_list ?? []} globalFontSize={globalFontSize} />
        )}
      </ScrollView>

      <Text className="pb-1 flex flex-wrap text-wrap break-all">
        <Text className="font-normal text-black" style={textStyle}>{item.addr}</Text>
      </Text>
        
      <PdEtKv
        item={item}
        textStyle={textStyle}
      />

      {item.fake_dom == 0 && <Text className="font-bold text-black pb-3" style={textStyle}>Домофон не работает</Text>}
      
      <HStack className="pb-1">
        <Text className="font-bold text-black" style={textStyle}>Ко времени: </Text>
        <Text className="font-normal text-black" style={textStyle}>{item.need_time}</Text>
      </HStack>

      { item.status_order != 1 ? false :
        <HStack className="pb-3">
          <Text className="font-bold text-black" style={textStyle}>Начнут готовить: </Text>
          <Text className="font-normal text-black" style={textStyle}>{item.time_start_order}</Text>
        </HStack>
      }

      { item.status_order != 6 ? false :
        <HStack className="pb-3">
          <Text className="font-bold text-black" style={textStyle}>Отдали: </Text>
          <Text className="font-normal text-black" style={textStyle}>{item.close_date_time_order}</Text>
        </HStack>
      }

      { item.status_order == 6 ? false :
        <HStack className="pb-3">
          <Text className="font-bold text-black" style={textStyle}>Осталось: </Text>
          <Text className="font-normal text-black" style={textStyle}>{item.to_time}</Text>
        </HStack>
      }

      { item?.comment?.length == 0 ? false :
        <CommentText comment={item.comment} showAlertText={showAlertText} globalFontSize={globalFontSize} dialCall={dialCall} />
      }
  
      <HStack className="pb-3">
        <Text className="font-bold text-black" style={textStyle}>Сумма: </Text>
        { item.online_pay == 1 ?
          <Text className="font-bold text-primary-main" style={textStyle}>Оплачено</Text>
            :
          <Text className="font-normal text-black" style={textStyle}>{FormatPrice(item.sum_order)}₽</Text>
        }
      </HStack>

      {item.sdacha == 0 || item.online_pay == 1 ? null : (
        <HStack className="pb-3">
          <Text className="font-bold text-black" style={textStyle}>Сдача с: </Text>
          <Text className="font-normal text-black" style={textStyle}>{FormatPrice(item.sdacha)}₽ ( {item.sum_sdacha}₽ )</Text>
        </HStack>
      )}

      <OrderActions
        item={item}
        dialCall={dialCall}
        setActiveConfirm={setActiveConfirm}
        actionButtonOrder={actionButtonOrder}
        globalFontSize={globalFontSize}
      />

    </Card>
  );
}

const areEqual = (prevProps: CardOrderProps, nextProps: CardOrderProps) => {
  return (
    prevProps.item.id_text === nextProps.item.id_text &&
    prevProps.item.is_delete === nextProps.item.is_delete &&
    prevProps.item.status_order === nextProps.item.status_order &&
    prevProps.item.to_time === nextProps.item.to_time &&
    prevProps.item.is_get === nextProps.item.is_get &&
    prevProps.item.is_my === nextProps.item.is_my
  );
};

export const CardOrder = React.memo(CardOrderComponent, areEqual);