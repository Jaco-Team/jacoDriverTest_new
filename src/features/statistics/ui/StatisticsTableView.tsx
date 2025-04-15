import React from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { Table, TableWrapper, Row, Cell } from 'react-native-reanimated-table'

import { StatisticsTableViewProps } from '../model/types'

// Ширины столбцов и заголовки
const widthHead = [200, 200, 200, 200, 200, 200, 200, 200]
const tableHead = [
  'Курьер',
  'Среднее время ( в радиусе )',
  'Количество',
  'Во время',
  'С опозданием',
  'Вовремя и в радиусе',
  'В радиусе',
  'Не вовремя и не в радиусе'
]

export function StatisticsTableView({ statArr, globalFontSize }: StatisticsTableViewProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <Table borderStyle={styles.borderTable}>
          <TableWrapper style={styles.row}>
            <Row
              data={tableHead}
              widthArr={widthHead}
              style={styles.header}
              textStyle={[styles.text_header, { fontSize: globalFontSize }]}
            />
          </TableWrapper>
        </Table>

        <ScrollView style={styles.dataWrapper}>
          <Table borderStyle={styles.borderTable}>
            {statArr.map((rowData, index) => {
              const backgroundStyle = index % 2 ? { backgroundColor: 'rgba(0, 0, 0, 0.04)' } : {}
              return (
                <TableWrapper key={index} style={[styles.row, backgroundStyle]}>
                  <Cell
                    data={rowData.name}
                    style={{ width: 200 }}
                    textStyle={[styles.text_row, { fontSize: globalFontSize }]}
                  />
                  <Cell
                    data={rowData.time2}
                    style={{ width: 200 }}
                    textStyle={[styles.text_row, { fontSize: globalFontSize }]}
                  />
                  <Cell
                    data={rowData.other_stat.all_count}
                    style={{ width: 200 }}
                    textStyle={[styles.text_row, { fontSize: globalFontSize }]}
                  />
                  <Cell
                    data={`${rowData.other_stat.norm} (${rowData.other_stat.norm_percent} %)`}
                    style={{ width: 200 }}
                    textStyle={[styles.text_row, { fontSize: globalFontSize }]}
                  />
                  <Cell
                    data={`${rowData.other_stat.fake} (${rowData.other_stat.fake_percent} %)`}
                    style={{ width: 200 }}
                    textStyle={[styles.text_row, { fontSize: globalFontSize }]}
                  />
                  <Cell
                    data={`${rowData.other_stat.time_dist_true} (${rowData.other_stat.time_dist_true_percent} %)`}
                    style={{ width: 200 }}
                    textStyle={[styles.text_row, { fontSize: globalFontSize }]}
                  />
                  <Cell
                    data={`${rowData.other_stat.true_dist} (${rowData.other_stat.true_dist_percent} %)`}
                    style={{ width: 200 }}
                    textStyle={[styles.text_row, { fontSize: globalFontSize }]}
                  />
                  <Cell
                    data={`${rowData.other_stat.time_dist_false} (${rowData.other_stat.time_dist_false_percent} %)`}
                    style={{ width: 200 }}
                    textStyle={[styles.text_row, { fontSize: globalFontSize }]}
                  />
                </TableWrapper>
              )
            })}
          </Table>
        </ScrollView>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  borderTable: {
    borderWidth: 1,
    borderColor: 'rgb(229, 229, 229)',
  },
  dataWrapper: {
    marginTop: -1,
  },
  header: {
    height: 80,
    backgroundColor: '#fff',
  },
  text_header: {
    padding: 6,
    fontWeight: '700',
    color: '#000',
  },
  text_row: {
    padding: 6,
    fontWeight: '400',
    color: '#000',
  },
  row: {
    flexDirection: 'row',
    minHeight: 30,
    backgroundColor: '#fff',
  },
})