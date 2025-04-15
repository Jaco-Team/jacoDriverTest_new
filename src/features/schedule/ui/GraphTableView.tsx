import React from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { Table, TableWrapper, Row, Cell } from 'react-native-reanimated-table'

interface IGraphTableViewProps {
  headerDay: string[]
  headerDow: string[]
  users: any[]        // Подставьте точные типы, если нужно
  userName: string
  thisDay: string
  globalFontSize: number
}

const tableBorder = {
  borderWidth: 1,
  borderColor: 'rgb(229, 229, 229)'
}

export function GraphTableView({
  headerDay,
  headerDow,
  users,
  userName,
  thisDay,
  globalFontSize
}: IGraphTableViewProps) {
  return (
    <View>
      {/* Первая таблица: день */}
      <Table borderStyle={tableBorder}>
        <TableWrapper style={styles.tableRow}>
          <Cell
            data={''}
            textStyle={[styles.celText, { width: 170, fontSize: globalFontSize }]}
          />
          <Row
            data={headerDay}
            style={{ minHeight: 30, backgroundColor: '#fff' }}
            textStyle={[styles.celText, { fontSize: globalFontSize }]}
          />
        </TableWrapper>
      </Table>

      {/* Вторая таблица: день недели */}
      <Table borderStyle={tableBorder}>
        <TableWrapper style={styles.tableRow}>
          <Cell
            data={'Сотрудники'}
            textStyle={[styles.celText, { width: 170, fontSize: globalFontSize }]}
          />
          <Row
            data={headerDow}
            style={{ minHeight: 30, backgroundColor: '#fff' }}
            textStyle={[styles.celText, { fontSize: globalFontSize }]}
          />
        </TableWrapper>
      </Table>

      {/* Третья таблица: основная, со списком пользователей */}
      <ScrollView style={{ marginTop: -1 }} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
        <Table borderStyle={tableBorder}>
          {users.map((rowData, index) => (
            <TableWrapper key={index} style={styles.tableRow}>
              {rowData.map((cellData: any, cellIndex: number) => {
                const isUserRow = rowData[0].user_name === userName
                // Пример логики фона ячейки
                const cellStyle =
                  isUserRow && cellData.date === thisDay
                    ? { backgroundColor: '#b0d959' }
                    : isUserRow
                    ? { backgroundColor: '#ffcc00' }
                    : index % 2
                    ? { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                    : {}

                return (
                  <Cell
                    key={cellIndex}
                    data={
                      cellIndex === 0
                        ? cellData.user_name
                        : cellData.min === 0
                        ? ''
                        : cellData.hours
                    }
                    textStyle={[
                      {
                        textAlign: cellIndex === 0 ? 'left' : 'center',
                        fontWeight: '400',
                        color: '#000',
                        width: cellIndex === 0 ? 170 : 50,
                        fontSize: globalFontSize,
                        padding: 5
                      }
                    ]}
                    style={cellStyle}
                  />
                )
              })}
            </TableWrapper>
          ))}
        </Table>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  tableRow: {
    flexDirection: 'row',
    minHeight: 30,
    backgroundColor: '#fff'
  },
  celText: {
    textAlign: 'center',
    fontWeight: '400',
    color: '#000',
    width: 50
  }
})