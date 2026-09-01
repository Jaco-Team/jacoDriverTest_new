import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { graphStyles } from './graphStyles'

interface GraphDate {
  date?: string
  day?: string
  dow?: string
}

interface GraphCell {
  date?: string
  hours?: number | string
  min?: number | string
  user_name?: string
}

interface GraphTableViewProps {
  dates: GraphDate[]
  headerDay: string[]
  headerDow: string[]
  users: GraphCell[][]
  userName: string
  thisDay: string
  globalFontSize: number
}

const EMPLOYEE_WIDTH = 180
const DAY_WIDTH = 64

function isWeekend(value: string | undefined): boolean {
  const normalized = String(value ?? '').toLowerCase()
  return normalized.includes('сб') || normalized.includes('вс')
}

export function GraphTableView({
  dates,
  headerDay,
  headerDow,
  users,
  userName,
  thisDay,
  globalFontSize,
}: GraphTableViewProps): React.JSX.Element {
  const tableWidth = EMPLOYEE_WIDTH + Math.max(dates.length, 1) * DAY_WIDTH

  const renderHeaderRow = (label: string, values: string[], isDow: boolean) => (
    <View style={[graphStyles.tableRow, { width: tableWidth }]}>
      <View style={[graphStyles.tableCell, graphStyles.headCell, styles.employeeCell]}>
        <Text style={[graphStyles.headText, { fontSize: globalFontSize }]}>
          {label}
        </Text>
      </View>
      {values.map((value, index) => {
        const today = dates[index]?.date === thisDay
        const weekend = isDow
          ? isWeekend(value)
          : isWeekend(headerDow[index])

        return (
          <View
            key={`${label}-${index}`}
            style={[
              graphStyles.tableCell,
              graphStyles.headCell,
              styles.dayCell,
              index === values.length - 1 && graphStyles.lastColumn,
              weekend && graphStyles.weekendCell,
              today && graphStyles.todayCell,
            ]}
          >
            <Text
              testID={`graph-header-${isDow ? 'dow' : 'date'}-${index}`}
              style={[
                graphStyles.headText,
                { fontSize: globalFontSize },
                weekend && graphStyles.weekendText,
              ]}
            >
              {value}
            </Text>
          </View>
        )
      })}
    </View>
  )

  return (
    <View style={{ minWidth: tableWidth }} testID="graph-schedule-table">
      {renderHeaderRow('Дата', headerDay, false)}
      {renderHeaderRow('Сотрудник', headerDow, true)}

      {users.length === 0 ? (
        <View style={[graphStyles.empty, { width: tableWidth }]}>
          <Text style={[graphStyles.emptyText, { fontSize: globalFontSize }]}>
            За выбранный месяц пока нет данных по графику.
          </Text>
        </View>
      ) : (
        users.map((rowData, rowIndex) => {
          const currentUser = rowData[0]?.user_name === userName
          const lastRow = rowIndex === users.length - 1

          return (
            <View
              key={`${rowData[0]?.user_name ?? 'employee'}-${rowIndex}`}
              style={[graphStyles.tableRow, { width: tableWidth }]}
            >
              {rowData.map((cellData, cellIndex) => {
                const nameCell = cellIndex === 0
                const today = !nameCell && cellData.date === thisDay
                const hasHours = !nameCell && Number(cellData.min) > 0
                const lastColumn = cellIndex === rowData.length - 1

                return (
                  <View
                    key={`${rowIndex}-${cellIndex}`}
                    style={[
                      graphStyles.tableCell,
                      nameCell ? styles.employeeCell : styles.dayCell,
                      lastColumn && graphStyles.lastColumn,
                      lastRow && graphStyles.lastRowCell,
                      hasHours && graphStyles.filledHoursCell,
                      currentUser && graphStyles.currentUserCell,
                      currentUser && nameCell && graphStyles.currentUserNameCell,
                      currentUser && today && graphStyles.currentTodayCell,
                    ]}
                  >
                    <Text
                      style={[
                        graphStyles.bodyText,
                        { fontSize: globalFontSize },
                        nameCell && styles.employeeText,
                        currentUser && graphStyles.currentUserText,
                      ]}
                    >
                      {nameCell
                        ? cellData.user_name
                        : hasHours
                          ? cellData.hours
                          : ''}
                    </Text>
                  </View>
                )
              })}
            </View>
          )
        })
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  employeeCell: {
    width: EMPLOYEE_WIDTH,
    alignItems: 'flex-start',
  },
  employeeText: {
    fontFamily: 'Roboto-Bold',
    textAlign: 'left',
  },
  dayCell: {
    width: DAY_WIDTH,
  },
})
