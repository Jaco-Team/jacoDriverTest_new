import React, { memo } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { DrawerContentComponentProps } from '@react-navigation/drawer'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faBriefcase,
  faCalculator,
  faChartLine,
  faChartSimple,
  faCircleExclamation,
  faGear,
  faHeadset,
  faMap,
  faReceipt,
  faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons'
import { Clock3 } from 'lucide-react-native'
import { useShallow } from 'zustand/react/shallow'

import { Analytics, AnalyticsEvent } from '@/analytics/AppMetricaService'
import { RU_SCREEN_NAMES } from '@/app/navigation/types'
import { useDialCall } from '@/shared/lib/useDialCall'
import { appPalette } from '@/shared/styles/appPalette'
import { useGlobalStore, useLoginStore } from '@/shared/store/store'

type DrawerRouteName =
  | 'List_orders'
  | 'Map'
  | 'Price'
  | 'Graph'
  | 'Statistics'
  | 'Settings'
  | 'FeedbackScreen'
  | 'OrdersUiPreview'

interface NavigationItem {
  route: DrawerRouteName
  label: string
  icon: IconDefinition
}

interface ContactItem {
  label: string
  phone: string
  icon: IconDefinition
  analyticsEvent: AnalyticsEvent
  analyticsTitle: string
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { route: 'List_orders', label: 'Список заказов', icon: faReceipt },
  { route: 'Map', label: 'Карта заказов', icon: faMap },
  { route: 'Price', label: 'Расчет', icon: faCalculator },
  { route: 'Graph', label: 'График работы', icon: faChartLine },
  { route: 'Statistics', label: 'Статистика', icon: faChartSimple },
  { route: 'Settings', label: 'Настройки', icon: faGear },
  { route: 'FeedbackScreen', label: 'Предложения', icon: faCircleExclamation },
  ...(__DEV__
    ? [
        {
          route: 'OrdersUiPreview' as const,
          label: 'UI заказов (DEV)',
          icon: faReceipt,
        },
      ]
    : []),
]

function clampFontSize(value: number, min: number, max: number): number {
  return Math.max(Math.min(value, max), min)
}

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const normalizedDigits =
    digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))
      ? digits.slice(1)
      : digits

  if (normalizedDigits.length !== 10) {
    return phone
  }

  return `+7 (${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(3, 6)}-${normalizedDigits.slice(6, 8)}-${normalizedDigits.slice(8, 10)}`
}

interface DrawerNavigationCardProps {
  item: NavigationItem
  fontSize: number
  selected: boolean
  onPress: () => void
}

function DrawerNavigationCard({
  item,
  fontSize,
  selected,
  onPress,
}: DrawerNavigationCardProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.navigationCard,
        selected && styles.navigationCardSelected,
      ]}
      testID={`drawer-route-${item.route}`}
      onPress={onPress}
    >
      <View style={styles.navigationIcon}>
        <FontAwesomeIcon
          color={selected ? appPalette.primary : appPalette.textMuted}
          icon={item.icon}
          size={22}
        />
      </View>
      <View style={styles.navigationText}>
        <Text
          numberOfLines={1}
          style={[
            styles.navigationLabel,
            { fontSize },
            selected && styles.navigationLabelSelected,
          ]}
        >
          {item.label}
        </Text>
      </View>
    </Pressable>
  )
}

interface DrawerContactCardProps {
  item: ContactItem
  labelFontSize: number
  phoneFontSize: number
  onPress: () => void
}

function DrawerContactCard({
  item,
  labelFontSize,
  phoneFontSize,
  onPress,
}: DrawerContactCardProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`${item.label}: ${formatPhoneNumber(item.phone)}`}
      accessibilityRole="button"
      style={styles.contactCard}
      testID={`drawer-contact-${item.label}`}
      onPress={onPress}
    >
      <View style={styles.contactIcon}>
        <FontAwesomeIcon color={appPalette.primary} icon={item.icon} size={25} />
      </View>
      <View style={styles.contactText}>
        <Text style={[styles.contactLabel, { fontSize: labelFontSize }]}>
          {item.label}
        </Text>
        <Text style={[styles.contactPhone, { fontSize: phoneFontSize }]}>
          {formatPhoneNumber(item.phone)}
        </Text>
      </View>
    </Pressable>
  )
}

export const CustomDrawerContent = memo(function CustomDrawerContent(
  props: DrawerContentComponentProps,
): React.JSX.Element {
  const [
    globalFontSize,
    phones,
    isNeedPageStat,
    avgTime,
  ] = useGlobalStore(
    useShallow((state) => [
      state.globalFontSize,
      state.phones,
      state.is_need_page_stat,
      state.avgTime,
    ]),
  )
  const logogout = useLoginStore((state) => state.logogout)
  const dialCall = useDialCall()

  const activeRoute = props.state.routeNames[props.state.index] ?? ''
  const currentTitle = RU_SCREEN_NAMES[activeRoute] || 'Меню'
  const navigationLabelFontSize = clampFontSize(globalFontSize, 15, 18)
  const contactLabelFontSize = clampFontSize(globalFontSize - 1, 14, 17)
  const contactPhoneFontSize = clampFontSize(globalFontSize - 2, 12, 15)

  const navigationItems = isNeedPageStat
    ? NAVIGATION_ITEMS
    : NAVIGATION_ITEMS.filter((item) => item.route !== 'Statistics')

  const contactItems: ContactItem[] = [
    ...(phones?.phone_upr
      ? [
          {
            label: 'Директор',
            phone: phones.phone_upr,
            icon: faBriefcase,
            analyticsEvent: AnalyticsEvent.DrawerCallDirector,
            analyticsTitle: 'Звонок директору',
          },
        ]
      : []),
    ...(phones?.phone_man
      ? [
          {
            label: 'Менеджер',
            phone: phones.phone_man,
            icon: faHeadset,
            analyticsEvent: AnalyticsEvent.DrawerCallManager,
            analyticsTitle: 'Звонок менеджеру',
          },
        ]
      : []),
    // Контакт-центр отсутствует в эталонном drawer сайта. Возвращать этот
    // пункт нужно вместе с соответствующим изменением эталонного интерфейса.
  ]

  function navigateTo(route: DrawerRouteName): void {
    props.navigation.navigate(route)
    props.navigation.closeDrawer()
  }

  function callContact(item: ContactItem): void {
    Analytics.log(item.analyticsEvent, item.analyticsTitle)
    props.navigation.closeDrawer()
    dialCall(item.phone)
  }

  async function logOut(): Promise<void> {
    const title = RU_SCREEN_NAMES.Auth ?? 'Авторизация'
    Analytics.log(AnalyticsEvent.ScreenOpen, `Открытие страницы ${title}`)

    props.navigation.closeDrawer()
    await logogout()
    props.navigation.reset({ index: 0, routes: [{ name: 'Auth' }] })
  }

  return (
    <View style={styles.root} testID="app-drawer">
      <SafeAreaView edges={['top']} style={styles.brandSafeArea}>
        <View style={styles.brandHeader}>
          <Text style={styles.brandEyebrow}>НАВИГАЦИЯ</Text>
          <Text numberOfLines={2} style={styles.brandTitle}>
            {currentTitle}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.drawerBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.averageCard} testID="drawer-average-time">
          <View style={styles.averageIcon}>
            <Clock3 color={appPalette.primary} size={25} strokeWidth={2} />
          </View>
          <View style={styles.averageText}>
            <Text style={styles.averageLabel}>СРЕДНЕЕ ВРЕМЯ</Text>
            <Text style={styles.averageValue}>{avgTime || '00:00:00'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>РАЗДЕЛЫ</Text>
          <View style={styles.cardList}>
            {navigationItems.map((item) => (
              <DrawerNavigationCard
                fontSize={navigationLabelFontSize}
                item={item}
                key={item.route}
                selected={activeRoute === item.route}
                onPress={() => navigateTo(item.route)}
              />
            ))}
          </View>
        </View>

        {contactItems.length > 0 ? (
          <View style={[styles.section, styles.contactsSection]}>
            <Text style={styles.sectionTitle}>КОНТАКТЫ</Text>
            <View style={styles.cardList}>
              {contactItems.map((item) => (
                <DrawerContactCard
                  item={item}
                  key={item.label}
                  labelFontSize={contactLabelFontSize}
                  phoneFontSize={contactPhoneFontSize}
                  onPress={() => callContact(item)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.logoutSection}>
          <Pressable
            accessibilityRole="button"
            style={styles.logoutButton}
            testID="drawer-logout"
            onPress={() => void logOut()}
          >
            <FontAwesomeIcon
              color={appPalette.brand}
              icon={faRightFromBracket}
              size={22}
            />
            <Text style={[styles.logoutText, { fontSize: globalFontSize }]}>Выйти</Text>
          </Pressable>
        </View>

        <SafeAreaView edges={['bottom']} />
      </ScrollView>
    </View>
  )
})

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: appPalette.brand,
  },
  brandSafeArea: {
    backgroundColor: appPalette.brand,
  },
  brandHeader: {
    position: 'relative',
    minHeight: 88,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: appPalette.brand,
  },
  drawerBody: {
    flex: 1,
    backgroundColor: '#F6F9FC',
  },
  brandEyebrow: {
    marginBottom: 8,
    color: 'rgba(255, 255, 255, 0.78)',
    fontFamily: 'Roboto-Bold',
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 1.2,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Black',
    fontSize: 28,
    lineHeight: 31,
  },
  scrollContent: {
    flexGrow: 1,
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  averageCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: appPalette.softStrong,
    borderRadius: 16,
    // Android по-разному композитит полупрозрачный фон рядом с elevation и
    // вложенными View. Непрозрачный эквивалент сохраняет цвет сайта цельным.
    backgroundColor: appPalette.surfaceAlt,
    shadowColor: appPalette.primaryDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  averageIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  averageText: {
    flex: 1,
    gap: 4,
    backgroundColor: 'transparent',
  },
  averageLabel: {
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Bold',
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.9,
  },
  averageValue: {
    color: appPalette.text,
    fontFamily: 'Roboto-Black',
    fontSize: 22,
    lineHeight: 25,
  },
  section: {
    gap: 8,
  },
  contactsSection: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: appPalette.border,
  },
  sectionTitle: {
    paddingHorizontal: 8,
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Bold',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 1.2,
  },
  cardList: {
    gap: 6,
  },
  navigationCard: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DCE2E7',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: appPalette.primaryDeep,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.04,
    shadowRadius: 11,
    elevation: 1,
  },
  navigationCardSelected: {
    borderColor: appPalette.primary,
    backgroundColor: appPalette.surfaceAlt,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  navigationIcon: {
    width: 40,
    marginLeft: 16,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  navigationText: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  navigationLabel: {
    color: appPalette.text,
    fontFamily: 'Roboto-Medium',
    lineHeight: 21,
    textAlign: 'center',
  },
  navigationLabelSelected: {
    fontFamily: 'Roboto-Bold',
  },
  contactCard: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DCE2E7',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: appPalette.primaryDeep,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.04,
    shadowRadius: 11,
    elevation: 1,
  },
  contactIcon: {
    width: 38,
    marginLeft: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  contactText: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'transparent',
  },
  contactLabel: {
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
    lineHeight: 20,
    textAlign: 'center',
  },
  contactPhone: {
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Regular',
    lineHeight: 18,
    textAlign: 'center',
  },
  logoutSection: {
    paddingTop: 14,
  },
  logoutButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: appPalette.brandSoftStrong,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: appPalette.primaryDeep,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.04,
    shadowRadius: 11,
    elevation: 1,
  },
  logoutText: {
    color: appPalette.brand,
    fontFamily: 'Roboto-Bold',
    lineHeight: 22,
  },
})
