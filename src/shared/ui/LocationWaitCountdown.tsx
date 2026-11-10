import React, { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { scaleGlobalFontSize } from '@/shared/lib/fontSize'
import { useGEOStore, useGlobalStore } from '@/shared/store/store'

const TICK_MS = 100

const RING_SIZE = 124
const RING_STROKE = 8
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
export const LOCATION_WAIT_RING_LENGTH = 2 * Math.PI * RING_RADIUS

// Кольцо лежит на затемнении общего спиннера, поэтому цвета не зависят от темы.
const RING_COLOR = '#FFFFFF'
const RING_TRACK = 'rgba(255, 255, 255, 0.22)'

export interface LocationWaitProgress {
  /** Сколько секунд осталось до продолжения без геопозиции. */
  seconds: number
  /** Оставшаяся доля всего ожидания, от 1 до 0. */
  fraction: number
}

export function useLocationWaitProgress(): LocationWaitProgress | null {
  const wait = useGEOStore(state => state.location_wait)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (wait === null) return undefined

    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [wait])

  if (wait === null) return null

  // До первого тика берём начало этапа, чтобы сразу показать полный срок.
  const effectiveNow = Math.max(now, wait.startedAt)
  const remainingMs = Math.max(0, wait.deadlineAt - effectiveNow)
  // Долю считаем от начала всего ожидания: повторная попытка не «перезаряжает» кольцо.
  const totalMs = wait.deadlineAt - (wait.firstStartedAt ?? wait.startedAt)

  return {
    seconds: Math.ceil(remainingMs / 1000),
    fraction: totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0,
  }
}

interface LocationWaitCountdownProps {
  style?: StyleProp<ViewStyle>
}

/** Как на сайте: ориентир, сколько ещё ждать геопозицию до продолжения без неё. */
export function LocationWaitCountdown({ style }: LocationWaitCountdownProps): React.JSX.Element | null {
  const progress = useLocationWaitProgress()
  const globalFontSize = useGlobalStore(state => state.globalFontSize)

  if (progress === null) return null

  const { seconds, fraction } = progress
  const labelFontSize = scaleGlobalFontSize(17, globalFontSize, 16, 20)
  const label = seconds > 0 ? 'Определяем местоположение' : 'Определяем местоположение…'

  return (
    <View
      accessible
      accessibilityLabel={seconds > 0 ? `${label}, осталось ${seconds} сек.` : label}
      accessibilityLiveRegion="polite"
      accessibilityRole="timer"
      style={[styles.container, style]}
      testID="location-wait-ring"
    >
      <View style={styles.ring}>
        <Svg height={RING_SIZE} style={StyleSheet.absoluteFill} width={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={RING_RADIUS}
            stroke={RING_TRACK}
            strokeWidth={RING_STROKE}
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={RING_RADIUS}
            stroke={RING_COLOR}
            strokeDasharray={`${LOCATION_WAIT_RING_LENGTH}`}
            strokeDashoffset={LOCATION_WAIT_RING_LENGTH * (1 - fraction)}
            strokeLinecap="round"
            strokeWidth={RING_STROKE}
            testID="location-wait-ring-progress"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        {seconds > 0 ? (
          <>
            <Text style={styles.seconds} testID="location-wait-seconds">{seconds}</Text>
            <Text style={styles.unit}>сек.</Text>
          </>
        ) : (
          // Срок вышел, а ответа ещё нет: показываем, что работа продолжается.
          <ActivityIndicator color={RING_COLOR} />
        )}
      </View>
      <Text
        style={[styles.label, { fontSize: labelFontSize, lineHeight: Math.round(labelFontSize * 1.3) }]}
        testID="location-wait-countdown"
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seconds: {
    color: RING_COLOR,
    fontFamily: 'Roboto-Bold',
    fontSize: 44,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    marginTop: -2,
    color: 'rgba(255, 255, 255, 0.72)',
    fontFamily: 'Roboto-Regular',
    fontSize: 14,
    lineHeight: 17,
  },
  label: {
    marginTop: 20,
    color: RING_COLOR,
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },
})
