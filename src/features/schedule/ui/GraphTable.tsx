import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { ChartNoAxesCombined } from 'lucide-react-native'

import { useGraphTable } from '../model/useGraphTable'
import { GraphTableView } from './GraphTableView'
import { useGraphStyles } from './graphStyles'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'
import { useIsOffline } from '@/shared/ui/ConnectivityLocationIndicator'

export function GraphTable(): React.JSX.Element {
  const { colors } = useAppTheme()
  const graphStyles = useGraphStyles()
  const isOffline = useIsOffline()
  const {
    dates,
    thisDay,
    headerDay,
    headerDow,
    users,
    user_name,
    globalFontSize,
  } = useGraphTable()
  const visibleDates = isOffline ? [] : dates

  return (
    <View style={graphStyles.card} testID="graph-schedule-card">
      <View style={graphStyles.cardHeader}>
        <View style={graphStyles.cardIcon}>
          <ChartNoAxesCombined color={colors.primary} size={23} />
        </View>
        <Text style={graphStyles.cardTitle}>Таблица смен</Text>
      </View>

      <View style={graphStyles.tableShell}>
        <View style={graphStyles.tableFrame}>
          {visibleDates.length === 0 ? (
            <GraphTableView
              dates={visibleDates}
              globalFontSize={globalFontSize}
              headerDay={isOffline ? [] : headerDay}
              headerDow={isOffline ? [] : headerDow}
              thisDay={thisDay}
              userName={isOffline ? '' : user_name}
              users={isOffline ? [] : users}
            />
          ) : (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              testID="graph-schedule-horizontal"
            >
              <GraphTableView
                dates={visibleDates}
                globalFontSize={globalFontSize}
                headerDay={isOffline ? [] : headerDay}
                headerDow={isOffline ? [] : headerDow}
                thisDay={thisDay}
                userName={isOffline ? '' : user_name}
                users={isOffline ? [] : users}
              />
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  )
}
