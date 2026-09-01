import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { ChartNoAxesCombined } from 'lucide-react-native'

import { appPalette } from '@/shared/styles/appPalette'
import { useGraphTable } from '../model/useGraphTable'
import { GraphTableView } from './GraphTableView'
import { graphStyles } from './graphStyles'

export function GraphTable(): React.JSX.Element {
  const {
    dates,
    thisDay,
    headerDay,
    headerDow,
    users,
    user_name,
    globalFontSize,
  } = useGraphTable()

  return (
    <View style={graphStyles.card} testID="graph-schedule-card">
      <View style={graphStyles.cardHeader}>
        <View style={graphStyles.cardIcon}>
          <ChartNoAxesCombined color={appPalette.primary} size={23} />
        </View>
        <Text style={graphStyles.cardTitle}>Таблица смен</Text>
      </View>

      <View style={graphStyles.tableShell}>
        <View style={graphStyles.tableFrame}>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            testID="graph-schedule-horizontal"
          >
            <GraphTableView
              dates={dates}
              globalFontSize={globalFontSize}
              headerDay={headerDay}
              headerDow={headerDow}
              thisDay={thisDay}
              userName={user_name}
              users={users}
            />
          </ScrollView>
        </View>
      </View>
    </View>
  )
}
