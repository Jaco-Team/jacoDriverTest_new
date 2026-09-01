import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { toOrderInt } from '@/entities/CardOrder/model/normalizeOrderValue'
import { getOrderNeedTime } from '@/entities/CardOrder/model/getOrderNeedTime'
import { CardOrderProps } from '@/entities/CardOrder/model/types'
import { appPalette } from '@/shared/styles/appPalette'

import { CardTagPopover } from './CardTagPopover'
import { CardTag } from './CardTag'
import { CommentText } from './CommentText'
import { PdEtKv } from './PdEtKv'
import { OrderActions } from './OrderActions'

export const ORDER_CARD_DELETED_BG = '#D95030'

export const CardOrderComponent: React.FC<CardOrderProps> = ({
  item,
  FormatPrice,
  showAlertText,
  globalFontSize,
  dialCall,
  actionButtonOrder,
  setActiveConfirm,
}) => {
  const isDeleted = toOrderInt(item.is_delete) === 1
  const statusOrder = toOrderInt(item.status_order)
  const onlinePay = toOrderInt(item.online_pay)
  const needTime = getOrderNeedTime(item)
  const textColor = isDeleted ? '#FFFFFF' : appPalette.text
  const mutedColor = isDeleted ? 'rgba(255, 255, 255, 0.84)' : appPalette.textMuted
  const bodyTextStyle = {
    color: textColor,
    fontSize: globalFontSize,
    lineHeight: globalFontSize + 6,
  }
  const labelTextStyle = [styles.label, bodyTextStyle]
  const valueTextStyle = [styles.value, bodyTextStyle]

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: isDeleted ? ORDER_CARD_DELETED_BG : '#FFFFFF' },
      ]}
      testID="order-card"
    >
      <Text
        style={[
          styles.title,
          {
            color: textColor,
            fontSize: globalFontSize + 2,
            lineHeight: globalFontSize + 8,
          },
        ]}
        testID="order-card-title"
      >
        {item.id_text}
      </Text>

      <View style={styles.tags} testID="order-card-tags">
        {toOrderInt(item.count_other) > 0 ? (
          <CardTag text="Роллы" color="blue" globalFontSize={globalFontSize} />
        ) : null}
        {toOrderInt(item.count_pasta) > 0 ? (
          <CardTag
            text="Паста"
            color="purpur"
            count={item.count_pasta}
            globalFontSize={globalFontSize}
          />
        ) : null}
        {toOrderInt(item.count_pizza) > 0 ? (
          <CardTag
            text="Пицца"
            color="red"
            count={item.count_pizza}
            globalFontSize={globalFontSize}
          />
        ) : null}
        {toOrderInt(item.count_drink) > 0 ? (
          <CardTagPopover
            text="Напиток"
            color="green"
            count={item.count_drink}
            array={item.drink_list ?? []}
            globalFontSize={globalFontSize}
          />
        ) : null}
      </View>

      <Text style={styles.infoRow} testID="order-address">
        <Text style={labelTextStyle}>Адрес: </Text>
        <Text style={valueTextStyle}>{item.addr}</Text>
      </Text>

      <PdEtKv
        item={item}
        textColor={textColor}
        textStyle={{ fontSize: globalFontSize, lineHeight: globalFontSize + 6 }}
      />

      {toOrderInt(item.fake_dom) === 0 ? (
        <Text
          style={[
            styles.infoRow,
            styles.value,
            {
              color: mutedColor,
              fontSize: globalFontSize,
              lineHeight: globalFontSize + 6,
            },
          ]}
          testID="order-intercom"
        >
          Домофон не работает
        </Text>
      ) : null}

      <Text style={styles.infoRow} testID="order-need-time">
        <Text style={labelTextStyle}>Ко времени: </Text>
        <Text style={valueTextStyle}>{needTime}</Text>
      </Text>

      {statusOrder === 1 ? (
        <Text style={styles.infoRow} testID="order-time-start">
          <Text style={labelTextStyle}>Начнут готовить: </Text>
          <Text style={valueTextStyle}>{item.time_start_order}</Text>
        </Text>
      ) : null}

      {statusOrder === 6 && item.close_date_time_order ? (
        <Text style={styles.infoRow} testID="order-time-close">
          <Text style={labelTextStyle}>Отдали: </Text>
          <Text style={valueTextStyle}>{item.close_date_time_order}</Text>
        </Text>
      ) : null}

      {statusOrder !== 6 ? (
        <Text style={styles.infoRow} testID="order-time-left">
          <Text style={labelTextStyle}>Осталось: </Text>
          <Text style={valueTextStyle}>{item.to_time}</Text>
        </Text>
      ) : null}

      {item.comment?.length > 0 ? (
        <CommentText
          comment={item.comment}
          showAlertText={showAlertText}
          globalFontSize={globalFontSize}
          dialCall={dialCall}
          textColor={textColor}
        />
      ) : null}

      {isDeleted && item.delete_reason ? (
        <Text style={styles.infoRow} testID="order-delete-reason">
          <Text style={labelTextStyle}>Причина удаления: </Text>
          <Text style={valueTextStyle}>{item.delete_reason}</Text>
        </Text>
      ) : null}

      <Text style={styles.infoRow} testID="order-price-sum">
        <Text style={labelTextStyle} testID="order-price-sum-label">
          Сумма:{' '}
        </Text>
        {onlinePay === 1 ? (
          <Text
            style={[
              styles.value,
              styles.paid,
              { fontSize: globalFontSize, lineHeight: globalFontSize + 6 },
            ]}
            testID="order-price-paid"
          >
            Оплачено
          </Text>
        ) : (
          <Text style={valueTextStyle} testID="order-price-sum-value">
            {FormatPrice(item.sum_order)}₽
          </Text>
        )}
      </Text>

      {toOrderInt(item.sdacha) !== 0 && onlinePay !== 1 ? (
        <Text style={styles.infoRow} testID="order-price-sdacha">
          <Text style={labelTextStyle} testID="order-price-sdacha-label">
            Сдача с:{' '}
          </Text>
          <Text style={valueTextStyle} testID="order-price-sdacha-value">
            {FormatPrice(item.sdacha)}₽ ({item.sum_sdacha}₽)
          </Text>
        </Text>
      ) : null}

      <OrderActions
        item={item}
        dialCall={dialCall}
        setActiveConfirm={setActiveConfirm}
        actionButtonOrder={actionButtonOrder}
        globalFontSize={globalFontSize}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  title: {
    marginBottom: 16,
    fontFamily: 'Roboto-Medium',
  },
  tags: {
    minHeight: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  infoRow: {
    marginBottom: 8,
  },
  label: {
    fontFamily: 'Roboto-Medium',
  },
  value: {
    fontFamily: 'Roboto-Regular',
  },
  paid: {
    color: '#4CAF50',
  },
})

const areEqual = (prevProps: CardOrderProps, nextProps: CardOrderProps) => {
  return (
    prevProps.item === nextProps.item &&
    prevProps.globalFontSize === nextProps.globalFontSize &&
    prevProps.FormatPrice === nextProps.FormatPrice &&
    prevProps.showAlertText === nextProps.showAlertText &&
    prevProps.dialCall === nextProps.dialCall &&
    prevProps.actionButtonOrder === nextProps.actionButtonOrder &&
    prevProps.setActiveConfirm === nextProps.setActiveConfirm
  )
}

export const CardOrder = React.memo(CardOrderComponent, areEqual)
