import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ReceiptText } from 'lucide-react-native'

import { appPalette } from '@/shared/styles/appPalette'
import { useErrorOrders } from '../model/useError'
import { ModalErrOrder } from './ModalErrOrder'
import { graphStyles } from './graphStyles'

export function ErrOrders(): React.JSX.Element {
  const { globalFontSize, err_orders, showModalErrOrder } = useErrorOrders()

  return (
    <View style={graphStyles.card} testID="graph-order-errors-card">
      <View style={graphStyles.cardHeader}>
        <View style={graphStyles.cardIcon}>
          <ReceiptText color={appPalette.primary} size={23} />
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

          {err_orders.length === 0 ? (
            <View style={graphStyles.empty}>
              <Text style={[graphStyles.emptyText, { fontSize: globalFontSize }]}>
                Ошибок по заказам за выбранный период нет.
              </Text>
            </View>
          ) : (
            err_orders.map((item, index) => {
              const lastRow = index === err_orders.length - 1

              return (
                <Pressable
                  accessibilityLabel={`Открыть ошибку по заказу ${item.order_id}`}
                  accessibilityRole="button"
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
