import { TouchableOpacity } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { View } from "react-native";
import { Copy } from 'lucide-react-native';

import { getNumberComment } from "@/shared/lib/getNumberComment";
import { getNumberCommentCheck } from "@/shared/lib/getNumberCommentCheck";

import { CommentTextProps } from "@/entities/CardOrder/model/types";

import {Analytics, AnalyticsEvent} from '@/analytics/AppMetricaService';

export const CommentText: React.FC<CommentTextProps> = ({ comment, showAlertText, globalFontSize, dialCall }) => {
  const check_number = getNumberCommentCheck(comment).length > 0;

  const handlePress = () => {
    const number = getNumberComment(comment);

    if( check_number ){
      Analytics.log(AnalyticsEvent.OrderCallClient, 'Звонок клиенту из комментария');
      dialCall(number);
    }else{
      Analytics.log(AnalyticsEvent.OrderClipboard, 'Копирование комментария из заказа');
      showAlertText(true, 'Скопировано');
      Clipboard.setString(number);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} className="pb-3" testID="comment-touch">
      <HStack className="items-center">
        <Text className={"items-center text-wrap flex flex-wrap break-all "+ (check_number ? 'w-11/12' : 'w-full') }>
          <Text className="font-bold text-black" style={{ fontSize: globalFontSize }}>Комментарий: </Text>
          <Text className="font-normal text-black leading-7" style={{ fontSize: globalFontSize }}>{comment}</Text>
        </Text>

        {check_number &&
          <View className="w-1/12">
            <Copy size={25} color={'#e5e5e5'} />
          </View>
        }
      </HStack>
    </TouchableOpacity>
  );
};
