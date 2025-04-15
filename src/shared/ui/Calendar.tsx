//import { Platform } from 'react-native';

import DateTimePickerModal from 'react-native-modal-datetime-picker';
//import DateTimePicker from '@react-native-community/datetimepicker';
import { ConfigType } from 'dayjs';

interface ModalCalendarType {
  is_show: boolean,
  date: string,
  changeDate: ( data: ConfigType ) => void,
  setShowCalendar: ( type: boolean ) => void
}

export function Calendar({ is_show, date, changeDate, setShowCalendar }: ModalCalendarType): React.JSX.Element {

  //if( Platform.OS == 'ios' ){
    return (
      <DateTimePickerModal
        isVisible={is_show}
        mode="date"
        date={new Date(date)}
        onConfirm={data => changeDate(data)}
        onCancel={() => setShowCalendar(false)}
      />
    ) 
  // }else{
  //   return (
  //     <DateTimePicker
  //       testID="dateTimePicker"
  //       value={new Date(date)}
  //       mode="date"
  //       display="calendar"
  //       onChange={(event, data) => changeDate(data)}
  //     />
  //   )
  // }
}