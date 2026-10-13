import React, {useCallback} from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import {useNavigation, type NavigationProp, type ParamListBase} from '@react-navigation/native'
import {Sparkles, X} from 'lucide-react-native'

import {useIsOffline} from '@/shared/lib/connectivityContext'
import {useGlobalStore} from '@/shared/store/store'
import {appPalette} from '@/shared/styles/appPalette'
import {useAppTheme} from '@/shared/theme/AppThemeProvider'

import {useOrderRecommendation} from '../model/useOrderRecommendation'
import {OrderRecommendationSheet} from './OrderRecommendationSheet'
import {NoSuitableOrdersSheet} from './NoSuitableOrdersSheet'

interface OrderRecommendationSectionProps {
  surface?: 'list' | 'map'
}

export function OrderRecommendationSection({
  surface = 'list',
}: OrderRecommendationSectionProps): React.JSX.Element | null {
  const {colors} = useAppTheme()
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const isOffline = useIsOffline()
  const fontSize = useGlobalStore(state => state.globalFontSize)
  const {
    close,
    closeNoSuitable,
    acceptedOrderIds,
    isLoading,
    isNoSuitableOpen,
    isOpen,
    isRouteVisible,
    isVisible,
    orders,
    orderTypeId,
    request,
    reset,
    result,
    showRoute,
    unavailableOrderIds,
  } = useOrderRecommendation(surface)

  const handleRequest = useCallback(async () => {
    const routeReady = await request()
    if (routeReady && surface === 'list') navigation.navigate('Map')
  }, [navigation, request, surface])

  const handleShowOnMap = useCallback(() => {
    showRoute()
    close()
  }, [close, showRoute])

  if (!isVisible || isOffline) return null

  const isMap = surface === 'map'
  const label = isLoading
    ? 'Анализ заказов…'
    : result
      ? 'Подробнее'
      : 'Помочь с выбором'
  const buttonLabel = isMap && isRouteVisible ? 'Подробнее' : label

  return (
    <>
      <View
        style={[
          isMap ? styles.mapContainer : styles.container,
          !isMap && {backgroundColor: colors.surface},
        ]}
        testID={isMap ? 'order-recommendation-map-control' : undefined}
      >
        <TouchableOpacity
          activeOpacity={0.78}
          accessibilityLabel={buttonLabel}
          accessibilityRole="button"
          accessibilityState={{busy: isLoading, disabled: isLoading}}
          disabled={isLoading}
          style={[
            styles.button,
            isMap && styles.mapButton,
            isMap && isRouteVisible && styles.activeRouteButton,
            {
              backgroundColor: colors.brand,
              shadowColor: colors.shadowStrong,
            },
          ]}
          testID={isMap ? 'order-recommendation-map-button' : 'order-recommendation-button'}
          onPress={() => void handleRequest()}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Sparkles color="#FFFFFF" size={22} strokeWidth={2.3} />
          )}
          <Text
            style={[
              styles.buttonText,
              {
                color: '#FFFFFF',
                fontSize: isMap ? Math.min(fontSize, 16) : fontSize,
              },
            ]}
          >
            {isMap && isRouteVisible
              ? 'Подробнее'
              : label}
          </Text>
        </TouchableOpacity>
        {isMap && isRouteVisible ? (
          <TouchableOpacity
            activeOpacity={0.78}
            accessibilityLabel="Сбросить рекомендации"
            accessibilityRole="button"
            style={[
              styles.hideRouteButton,
              {backgroundColor: colors.brand, shadowColor: colors.shadowStrong},
            ]}
            testID="order-recommendation-route-hide"
            onPress={reset}
          >
            <X color="#FFFFFF" size={21} strokeWidth={2.4} />
          </TouchableOpacity>
        ) : null}
      </View>

      {isMap ? (
        <OrderRecommendationSheet
          fontSize={fontSize}
          isOpen={isOpen}
          acceptedOrderIds={acceptedOrderIds}
          unavailableOrderIds={unavailableOrderIds}
          orders={orders}
          orderTypeId={orderTypeId}
          result={result}
          showMapAction={false}
          onClose={close}
          onShowOnMap={handleShowOnMap}
        />
      ) : null}

      <NoSuitableOrdersSheet
        fontSize={fontSize}
        isOpen={isNoSuitableOpen}
        onClose={closeNoSuitable}
      />

    </>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: appPalette.surface,
  },
  mapContainer: {
    position: 'absolute',
    top: 10,
    left: 64,
    right: 64,
    zIndex: 23,
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: appPalette.brand,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  mapButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    elevation: 4,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  activeRouteButton: {
    paddingHorizontal: 8,
  },
  hideRouteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    elevation: 4,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 1,
    shadowRadius: 5,
  },
})
