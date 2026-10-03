import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ReceiptText } from 'lucide-react-native'

import { useErrorOrders } from '../model/useError'
import { ModalErrOrder } from './ModalErrOrder'
import { useGraphStyles } from './graphStyles'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'
import { useIsOffline } from '@/shared/ui/ConnectivityLocationIndicator'

export function ErrOrders(): React.JSX.Element {
  const { colors } = useAppTheme()
  const graphStyles = useGraphStyles()
  const isOffline = useIsOffline()
  const { globalFontSize, err_orders, showModalErrOrder } = useErrorOrders()
  const visibleErrors = isOffline ? [] : err_orders

  React.useEffect(() => {
    if (isOffline) showModalErrOrder(false)
  }, [isOffline, showModalErrOrder])

  return (
    <View style={graphStyles.card} testID="graph-order-errors-card">
      <View style={graphStyles.cardHeader}>
        <View style={graphStyles.cardIcon}>
          <ReceiptText color={colors.primary} size={23} />
        </View>
        <Text style={graphStyles.cardTitle}>Ошибки по заказам</Text>
      </View>

      <View style={graphStyles.tableShell}>
        <View style={graphStyles.tableFrame}>
          <View style={graphStyles.tableRow}>
            <View style={[graphStyles.tableCell, graphStyles.headCell, styles.dateCell]}>
              <Text style={[graphStyles.headText, { fontSize: globalFontSize }]}>
                Дата заказа
              </Text>
            </View>
            <View
              style={[
                graphStyles.tableCell,
                graphStyles.headCell,
                graphStyles.lastColumn,
                styles.errorCell,
              ]}
            >
              <Text style={[graphStyles.headText, { fontSize: globalFontSize }]}>
                Ошибка
              </Text>
            </View>
          </View>

          {visibleErrors.length === 0 ? (
            <View style={graphStyles.empty}>
              <Text style={[graphStyles.emptyText, { fontSize: globalFontSize }]}>
                Ошибок по заказам за выбранный период нет.
              </Text>
            </View>
          ) : (
            visibleErrors.map((item, index) => {
              const lastRow = index === visibleErrors.length - 1

              return (
                <Pressable
                  accessibilityLabel={`Открыть ошибку по заказу ${item.order_id}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isOffline }}
                  disabled={isOffline}
                  key={`${item.err_id}-${item.row_id}-${index}`}
                  style={graphStyles.tableRow}
                  testID={`graph-order-error-${index}`}
                  onPress={() => showModalErrOrder(true, item)}
                >
                  <View
                    style={[
                      graphStyles.tableCell,
                      styles.dateCell,
                      lastRow && graphStyles.lastRowCell,
                    ]}
                  >
                    <Text style={[graphStyles.bodyText, { fontSize: globalFontSize }]}>
                      {item.date_time_order}
                    </Text>
                  </View>
                  <View
                    style={[
                      graphStyles.tableCell,
                      graphStyles.lastColumn,
                      styles.errorCell,
                      lastRow && graphStyles.lastRowCell,
                    ]}
                  >
                    <Text style={[graphStyles.bodyText, { fontSize: globalFontSize }]}>
                      {item.pr_name}
                    </Text>
                  </View>
                </Pressable>
              )
            })
          )}
        </View>
      </View>

      <ModalErrOrder />
    </View>
  )
}

const styles = StyleSheet.create({
  dateCell: {
    width: '46%',
    alignItems: 'flex-start',
  },
  errorCell: {
    width: '54%',
    alignItems: 'flex-start',
  },
})
