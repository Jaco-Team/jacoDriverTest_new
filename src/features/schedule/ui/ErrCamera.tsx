import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Video } from 'lucide-react-native'

import { appPalette } from '@/shared/styles/appPalette'
import { useErrorCamera } from '../model/useError'
import { ModalErrCam } from './ModalErrCam'
import { graphStyles } from './graphStyles'

export function ErrCamera(): React.JSX.Element {
  const { globalFontSize, err_cam, showModalErrCam } = useErrorCamera()

  return (
    <View style={graphStyles.card} testID="graph-camera-errors-card">
      <View style={graphStyles.cardHeader}>
        <View style={graphStyles.cardIcon}>
          <Video color={appPalette.primary} size={23} />
        </View>
        <Text style={graphStyles.cardTitle}>Ошибки по камерам</Text>
      </View>

      <View style={graphStyles.tableShell}>
        <View style={graphStyles.tableFrame}>
          <View style={graphStyles.tableRow}>
            <View style={[graphStyles.tableCell, graphStyles.headCell, styles.dateCell]}>
              <Text style={[graphStyles.headText, { fontSize: globalFontSize }]}>
                Дата и время
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

          {err_cam.length === 0 ? (
            <View style={graphStyles.empty}>
              <Text style={[graphStyles.emptyText, { fontSize: globalFontSize }]}>
                Ошибок по камерам за выбранный период нет.
              </Text>
            </View>
          ) : (
            err_cam.map((item, index) => {
              const lastRow = index === err_cam.length - 1

              return (
                <Pressable
                  accessibilityLabel={`Открыть ошибку ${item.id}`}
                  accessibilityRole="button"
                  key={`${item.id}-${index}`}
                  style={graphStyles.tableRow}
                  testID={`graph-camera-error-${index}`}
                  onPress={() => showModalErrCam(true, item)}
                >
                  <View
                    style={[
                      graphStyles.tableCell,
                      styles.dateCell,
                      lastRow && graphStyles.lastRowCell,
                    ]}
                  >
                    <Text style={[graphStyles.bodyText, { fontSize: globalFontSize }]}>
                      {item.date_time_fine}
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
                      {item.fine_name}
                    </Text>
                  </View>
                </Pressable>
              )
            })
          )}
        </View>
      </View>

      <ModalErrCam />
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
