import React from 'react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGraphLogic } from '../model/useGraphLogic'
import { ChooseMonth } from './ChooseMonth'
import { ErrCamera } from './ErrCamera'
import { ErrOrders } from './ErrOrders'
import { GraphTable } from './GraphTable'
import { graphStyles } from './graphStyles'

export function GraphScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets()

  useGraphLogic()

  return (
    <View style={graphStyles.screen} testID="graph-screen">
      <ScrollView
        contentContainerStyle={[
          graphStyles.content,
          { paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
        testID="graph-scroll"
      >
        <ChooseMonth />
        <GraphTable />
        <ErrOrders />
        <ErrCamera />
      </ScrollView>
    </View>
  )
}
