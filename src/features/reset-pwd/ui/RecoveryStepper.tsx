import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

interface RecoveryStepperProps {
  activeStep: 0 | 1
}

export function RecoveryStepper({
  activeStep,
}: RecoveryStepperProps): React.JSX.Element {
  return (
    <View
      accessible
      accessibilityLabel={`Шаг ${activeStep + 1} из 2`}
      style={styles.container}
      testID="reset-stepper"
    >
      <View style={styles.markers}>
        <View style={styles.markerColumn}>
          <View style={styles.markerHalo}>
            <View style={styles.activeCircle}>
              <Text style={styles.activeCircleText}>
                {activeStep === 1 ? '✓' : '1'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.connectionLine} />

        <View style={styles.markerColumn}>
          <View style={styles.markerHalo}>
            <View
              style={
                activeStep === 1 ? styles.activeCircle : styles.inactiveCircle
              }
            >
              <Text
                style={
                  activeStep === 1
                    ? styles.activeCircleText
                    : styles.inactiveCircleText
                }
              >
                2
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.labels}>
        <Text style={styles.activeLabel}>Телефон</Text>
        <Text
          style={activeStep === 1 ? styles.activeLabel : styles.inactiveLabel}
        >
          Подтверждение
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 4,
    marginBottom: 22,
  },
  markers: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  markerColumn: {
    zIndex: 2,
    width: '50%',
    alignItems: 'center',
  },
  markerHalo: {
    width: 40,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  activeCircle: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#CC0033',
  },
  activeCircleText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontSize: 12,
    lineHeight: 16,
  },
  inactiveCircle: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(53, 38, 43, 0.42)',
  },
  inactiveCircleText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontSize: 12,
    lineHeight: 16,
  },
  connectionLine: {
    position: 'absolute',
    zIndex: 1,
    top: 12,
    right: '25%',
    left: '25%',
    height: 1,
    backgroundColor: 'rgba(53, 38, 43, 0.28)',
  },
  labels: {
    marginTop: 9,
    flexDirection: 'row',
  },
  activeLabel: {
    width: '50%',
    color: '#A6002A',
    fontFamily: 'Roboto-Bold',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  inactiveLabel: {
    width: '50%',
    color: 'rgba(83, 59, 66, 0.58)',
    fontFamily: 'Roboto-Bold',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
})
