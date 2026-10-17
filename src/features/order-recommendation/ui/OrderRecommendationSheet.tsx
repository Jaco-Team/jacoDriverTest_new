import React, {useMemo} from 'react'
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import {AlertCircle, Check, Route, Sparkles} from 'lucide-react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet'
import {appPalette} from '@/shared/styles/appPalette'
import type {Order} from '@/shared/store/OrdersStoreType'
import {useAppTheme} from '@/shared/theme/AppThemeProvider'
import {scaleGlobalFontSize} from '@/shared/lib/fontSize'

import {
  formatRecommendationDistance,
  recommendationStopLabel,
  sortRecommendationStops,
} from '../model/recommendationRoute'
import {
  buildRecommendationRouteMapPoints,
} from '../model/recommendationRouteMap'
import type {OrderRecommendationResult} from '../model/orderRecommendation.types'

interface OrderRecommendationSheetProps {
  fontSize: number
  isOpen: boolean
  orders: Order[]
  acceptedOrderIds?: number[]
  unavailableOrderIds?: number[]
  orderTypeId?: number
  result: OrderRecommendationResult | null
  onClose: () => void
  onShowOnMap: () => void
  showMapAction?: boolean
}

export function OrderRecommendationSheet({
  fontSize,
  isOpen,
  orders,
  acceptedOrderIds = [],
  unavailableOrderIds = [],
  orderTypeId,
  result,
  onClose,
  onShowOnMap,
  showMapAction = true,
}: OrderRecommendationSheetProps): React.JSX.Element | null {
  const {bottom} = useSafeAreaInsets()
  const {colors} = useAppTheme()
  const sheetHeight = Math.round(Dimensions.get('window').height * 0.88)
  const orderById = useMemo(
    () => new Map(orders.map(order => [order.id, order])),
    [orders],
  )
  const acceptedIds = useMemo(() => new Set(acceptedOrderIds), [acceptedOrderIds])
  const unavailableIds = useMemo(
    () => new Set(unavailableOrderIds),
    [unavailableOrderIds],
  )
  const recommendedOrders = useMemo(
    () => (result?.take ?? []).filter(item => !unavailableIds.has(item.id)),
    [result?.take, unavailableIds],
  )
  const stops = useMemo(
    () => sortRecommendationStops(result?.route?.stops).filter(
      stop => stop.id === null || !unavailableIds.has(stop.id),
    ),
    [result?.route?.stops, unavailableIds],
  )
  const mapPoints = useMemo(
    () => buildRecommendationRouteMapPoints(stops, orderById),
    [orderById, stops],
  )
  const distance = formatRecommendationDistance(result?.route?.total_distance_m)
  const routeSummary = [
    result?.route?.total_minutes
      ? `Примерно ${result.route.total_minutes} мин`
      : '',
    distance || '',
  ].filter(Boolean).join(' · ')
  const titleSize = scaleGlobalFontSize(20, fontSize, 18, 24)
  const sectionSize = scaleGlobalFontSize(17, fontSize, 16, 20)
  const bodySize = scaleGlobalFontSize(16, fontSize, 14, 19)
  const helperSize = scaleGlobalFontSize(15, fontSize, 13, 17)
  const visibleWarnings = (result?.warnings ?? []).filter(
    warning => !/остальн.*лучше не брать/i.test(warning),
  )
  const hasDetails = Boolean(
    recommendedOrders.length ||
    stops.length ||
    visibleWarnings.length,
  )

  // Не оставляем закрытый overlay в дереве: он не должен перехватывать
  // нажатия по списку после закрытия подсказки.
  if (!isOpen) return null

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop testID="order-recommendation-backdrop" />
      <ActionsheetContent
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            minHeight: sheetHeight,
            maxHeight: sheetHeight,
            borderColor: colors.border,
            backgroundColor: colors.aiSurface,
          },
        ]}
        testID="order-recommendation-sheet"
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator style={styles.handleArea}>
            <Pressable
              accessibilityLabel="Закрыть ИИ-подсказку"
              accessibilityRole="button"
              style={styles.handleButton}
              testID="order-recommendation-handle"
              onPress={onClose}
            >
              <View style={[styles.handle, {backgroundColor: colors.border}]} />
            </Pressable>
          </ActionsheetDragIndicator>
        </ActionsheetDragIndicatorWrapper>

        <View style={styles.header}>
          <View style={[styles.iconBox, {backgroundColor: colors.brandSoft}]}>
            <Sparkles color={colors.brand} size={25} strokeWidth={2.25} />
          </View>
          <Text
            style={[styles.title, {color: colors.text, fontSize: titleSize}]}
            testID="order-recommendation-title"
          >
            Рекомендации по заказам
          </Text>
        </View>

        {result?.summary && unavailableOrderIds.length === 0 ? (
          <Text
            style={[
              styles.summary,
              {color: colors.textMuted, fontSize: bodySize},
            ]}
          >
            {result.summary}
          </Text>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          testID="order-recommendation-scroll"
        >
          {!hasDetails ? (
            <Text style={[styles.emptyText, {color: colors.textMuted, fontSize: bodySize}]}>
              Сервер не вернул подробный план. Попробуйте запросить совет ещё раз.
            </Text>
          ) : null}

          {recommendedOrders.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, {color: colors.text, fontSize: sectionSize}]}>
                {orderTypeId === 2 ? 'Заказы в маршруте' : 'Какие заказы взять'}
              </Text>
              <View style={styles.cards}>
                {recommendedOrders.map(item => {
                  const order = orderById.get(item.id)

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.card,
                        {borderColor: colors.border, backgroundColor: colors.aiCard},
                      ]}
                      testID={`order-recommendation-order-${item.id}`}
                    >
                      <View style={styles.cardTitleRow}>
                        <View style={[styles.sequence, {backgroundColor: colors.surfaceAlt}]}>
                          <Text style={[styles.sequenceText, {color: colors.text, fontSize: helperSize}]}>
                            {item.seq}
                          </Text>
                        </View>
                        <Text style={[styles.cardTitle, {color: colors.text, fontSize: bodySize}]}>
                          {order?.id_text || `Заказ №${item.id}`}
                        </Text>
                        {acceptedIds.has(item.id) ? (
                          <View style={[styles.accepted, {backgroundColor: colors.aiAccepted}]}>
                            <Check color="#FFFFFF" size={15} strokeWidth={3} />
                          </View>
                        ) : null}
                      </View>
                      {order?.addr ? (
                        <Text style={[styles.helperText, {color: colors.textMuted, fontSize: helperSize}]}>
                          {order.addr}
                        </Text>
                      ) : null}
                      <Text style={[styles.reason, {color: colors.text, fontSize: bodySize}]}>
                        {item.reason}
                      </Text>
                      {item.pickup_at || item.deliver_at ? (
                        <Text style={[styles.times, {color: colors.textMuted, fontSize: helperSize}]}>
                          {item.pickup_at ? `Забрать: ${item.pickup_at}` : ''}
                          {item.pickup_at && item.deliver_at ? ' · ' : ''}
                          {item.deliver_at ? `Доставить: ${item.deliver_at}` : ''}
                        </Text>
                      ) : null}
                    </View>
                  )
                })}
              </View>
            </View>
          ) : null}

          {stops.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Route color={colors.brand} size={22} strokeWidth={2.25} />
                <Text style={[styles.sectionTitle, {color: colors.text, fontSize: sectionSize}]}>
                  Маршрут
                </Text>
              </View>
              {routeSummary && unavailableOrderIds.length === 0 ? (
                <Text style={[styles.routeSummary, {color: colors.textMuted, fontSize: helperSize}]}>
                  {routeSummary}
                </Text>
              ) : null}
              <View style={styles.routeRows}>
                {stops.map((stop, index) => (
                  <View
                    key={`${stop.kind}-${stop.id ?? 'start'}-${stop.seq}`}
                    style={styles.routeRow}
                  >
                    <Text style={[styles.routeNumber, {color: colors.brand, fontSize: helperSize}]}>
                      {index + 1}
                    </Text>
                    <Text style={[styles.routeLabel, {color: colors.text, fontSize: bodySize}]}>
                      {recommendationStopLabel(
                        stop,
                        stop.id ? orderById.get(stop.id) : undefined,
                      )}
                    </Text>
                    {stop.eta ? (
                      <Text style={[styles.routeTime, {color: colors.textMuted, fontSize: helperSize}]}>
                        {stop.eta}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
              {showMapAction && mapPoints.length > 1 ? (
                <TouchableOpacity
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  style={[styles.mapButton, {borderColor: colors.brand}]}
                  testID="order-recommendation-map-open"
                  onPress={onShowOnMap}
                >
                  <Route color={colors.brand} size={20} strokeWidth={2.25} />
                  <Text style={[styles.mapButtonText, {color: colors.brand, fontSize: bodySize}]}>
                    Показать маршрут на карте
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {visibleWarnings.length > 0 ? (
            <View style={[styles.warnings, {borderTopColor: colors.border}]}>
              {visibleWarnings.map((warning, index) => (
                <View key={`${warning}-${index}`} style={styles.warningRow}>
                  <AlertCircle color={colors.brand} size={20} strokeWidth={2.1} />
                  <Text style={[styles.warningText, {color: colors.text, fontSize: helperSize}]}>
                    {warning}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {backgroundColor: colors.aiSurface, paddingBottom: bottom + 12},
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.78}
            accessibilityRole="button"
            style={[styles.closeButton, {backgroundColor: colors.brand}]}
            testID="order-recommendation-close"
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, {fontSize: bodySize}]}>Закрыть</Text>
          </TouchableOpacity>
        </View>
      </ActionsheetContent>
    </Actionsheet>
  )
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    overflow: 'hidden',
    padding: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    backgroundColor: appPalette.surfaceRaised,
  },
  handleArea: {
    width: '100%',
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  handleButton: {
    width: '100%',
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  title: {
    flex: 1,
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    lineHeight: 29,
  },
  summary: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    fontFamily: 'Roboto-Regular',
    lineHeight: 24,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  emptyText: {
    paddingVertical: 16,
    fontFamily: 'Roboto-Regular',
    lineHeight: 23,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 9,
  },
  sectionTitle: {
    marginBottom: 9,
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    lineHeight: 24,
  },
  cards: {
    gap: 8,
  },
  card: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sequence: {
    minWidth: 32,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  sequenceText: {
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },
  cardTitle: {
    flex: 1,
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    lineHeight: 22,
  },
  accepted: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  helperText: {
    marginBottom: 5,
    fontFamily: 'Roboto-Regular',
    lineHeight: 20,
  },
  reason: {
    fontFamily: 'Roboto-Regular',
    lineHeight: 22,
  },
  times: {
    marginTop: 7,
    fontFamily: 'Roboto-Regular',
    lineHeight: 20,
  },
  routeSummary: {
    marginTop: -5,
    marginBottom: 10,
    fontFamily: 'Roboto-Regular',
    lineHeight: 20,
  },
  routeRows: {
    gap: 8,
  },
  mapButton: {
    minHeight: 46,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 14,
  },
  mapButtonText: {
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  routeNumber: {
    width: 26,
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  routeLabel: {
    flex: 1,
    fontFamily: 'Roboto-Regular',
    lineHeight: 22,
  },
  routeTime: {
    minWidth: 42,
    fontFamily: 'Roboto-Regular',
    lineHeight: 22,
    textAlign: 'right',
  },
  warnings: {
    gap: 8,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontFamily: 'Roboto-Regular',
    lineHeight: 21,
  },
  footer: {
    width: '100%',
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  closeButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    lineHeight: 22,
  },
})
