import React, {useEffect, useMemo, useState, type ReactNode} from 'react'
import {Alert, Image, Linking, Pressable, ScrollView, Text, TouchableOpacity, View} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import {
  Calculator,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  Tag,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native'
import Svg, {Circle, Path} from 'react-native-svg'
import {useShallow} from 'zustand/react/shallow'

import type {CabinetData, CabinetHealthBook, CabinetPromo} from '@/shared/api/laravel/cabinet'
import {resolveMarkerTheme} from '@/shared/lib/markerTheme'
import {useGlobalStore, useSettingsStore} from '@/shared/store/store'
import {useAppTheme} from '@/shared/theme/AppThemeProvider'
import {MarkerText} from '@/shared/ui/MarkerText'

import {
  cabinetMarkerLabel,
  formatCabinetDate,
  formatExperience,
  formatPromoTiming,
  healthSummary,
  sortedHealthChecks,
  visibleCabinetMaterials,
} from '../model/cabinetDetails'
import {createCabinetStyles, type CabinetStyles} from './cabinetStyles'

export type CabinetTarget = 'Graph' | 'Price' | 'Statistics' | 'Settings'

type CabinetExpansion = {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

export type CabinetSections = {
  profile: CabinetExpansion
  documents: CabinetExpansion
}

type Appearance = Pick<ReturnType<typeof useAppTheme>, 'colors' | 'isDark'> & {
  styles: CabinetStyles
  font: number
}

type CabinetContentProps = {
  fullName: string | null
  data?: CabinetData | null
  photoUrl?: string | null
  onPhotoLoad?: () => void
  onPhotoError?: () => void
  onNavigate: (target: CabinetTarget) => void
  sections: CabinetSections
  offline?: boolean
  notice?: string
  hidden?: boolean
}

function SectionTitle({
  appearance: {styles, colors}, Icon, title, subtitle, expanded,
}: {
  appearance: Appearance
  Icon?: LucideIcon
  title: string
  subtitle?: string[]
  expanded?: boolean
}) {
  return (
    <View style={styles.titleRow}>
      {Icon && (
        <View style={styles.sectionIcon}>
          <Icon color={colors.primary} size={21} />
        </View>
      )}
      <View style={styles.titleCopy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle?.map((line) => <Text key={line} style={styles.muted}>{line}</Text>)}
      </View>
      {expanded === true && <ChevronUp color={colors.primary} size={20} />}
      {expanded === false && <ChevronDown color={colors.primary} size={20} />}
    </View>
  )
}

function ExpandableCard({
  appearance, Icon, title, subtitle, expansion: {expanded, onExpandedChange}, children,
}: {
  appearance: Appearance
  Icon: LucideIcon
  title: string
  subtitle: string[]
  expansion: CabinetExpansion
  children?: ReactNode
}) {
  const {styles} = appearance

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[title, ...subtitle].join(', ')}
        accessibilityState={{expanded}}
        onPress={() => onExpandedChange(!expanded)}
      >
        <SectionTitle {...{appearance, Icon, title, subtitle, expanded}} />
      </Pressable>
      {expanded && children}
    </View>
  )
}

function ProfileCard({
  appearance, fullName, data, expansion,
}: {appearance: Appearance; fullName: string | null; data: CabinetData; expansion: CabinetExpansion}) {
  const {styles} = appearance
  const experience = formatExperience(data.experience_months)
  const facts = [
    {label: 'ФИО', value: fullName},
    {label: 'Должность', value: data.appointment_name},
    {label: 'Место работы', value: data.workplace_name},
    {label: 'Дата регистрации', value: formatCabinetDate(data.registration_date)},
    {label: 'Стаж работы', value: experience},
  ].filter(({value}) => Boolean(value))

  if (facts.length === 0) return null

  return (
    <ExpandableCard
      appearance={appearance}
      Icon={UserRound}
      title="Профиль"
      expansion={expansion}
      subtitle={[experience ? 'Стаж ' + experience.toLowerCase() : 'Личные данные']}
    >
      <View style={styles.detailBody}>
        {facts.map(({label, value}, index) => (
          <React.Fragment key={label}>
            {index > 0 && <View style={styles.divider} testID="cabinet-profile-divider" />}
            <View style={styles.fact}>
              <Text style={[styles.body, styles.strong]}>{label}</Text>
              <Text style={styles.muted}>{value}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </ExpandableCard>
  )
}

function ActionRow({
  appearance: {styles, colors}, label, onPress, Icon, external, settings,
}: {
  appearance: Appearance
  label: string
  onPress: () => void
  Icon?: LucideIcon
  external?: boolean
  settings?: boolean
}) {
  const Arrow = external ? ExternalLink : ChevronRight

  return (
    <TouchableOpacity
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={label}
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.action, external && styles.material, settings && styles.settingsAction]}
    >
      {Icon && <Icon color={colors.primary} size={21} />}
      <Text style={[styles.body, styles.strong, styles.flexText]}>{label}</Text>
      <Arrow color={colors.primary} size={18} />
    </TouchableOpacity>
  )
}

const workLinks = [
  {target: 'Graph', label: 'График работы', Icon: CalendarDays},
  {target: 'Price', label: 'Расчёт', Icon: Calculator},
  {target: 'Statistics', label: 'Статистика', Icon: ChartNoAxesCombined},
] as const

function HealthBookChecks({
  items, appearance: {styles},
}: {items: NonNullable<CabinetHealthBook['items']>; appearance: Appearance}) {
  const checks = sortedHealthChecks(items)
  const earliest = checks[0]?.valid_until
  return (
    <View>
      <Text style={styles.groupTitle}>Осмотры и анализы</Text>
      <View style={styles.groupList}>
        {checks.length === 0 && <Text style={styles.muted}>Данных по медкнижке нет.</Text>}
        {checks.map(({type, name, valid_until: date}, index) => (
          <React.Fragment key={type}>
            {index > 0 && <View style={styles.divider} testID="cabinet-exam-divider" />}
            <View style={styles.examRow}>
              <Text style={[styles.body, styles.examName]}>{name}</Text>
              <Text style={[
                styles.muted, styles.examDate,
                date !== null && date === earliest && styles.nearestDate,
              ]}>
                {date ? 'до ' + formatCabinetDate(date) : 'Не заполнено'}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  )
}

function DocumentsCard({data, appearance, expansion}: {
  data: CabinetData
  appearance: Appearance
  expansion: CabinetExpansion
}) {
  const {styles} = appearance
  const {health_book: healthBook, issued_clothes: clothes} = data
  const materials = visibleCabinetMaterials(data.instructions)
  const unavailable = data.unavailable.some(
    (item) => item === 'health_book' || item === 'instructions' || item === 'issued_clothes',
  )
  if (!healthBook && materials.length === 0 && clothes.length === 0 && !unavailable) return null

  return (
    <ExpandableCard
      appearance={appearance}
      Icon={FileText}
      title="Документы и допуски"
      expansion={expansion}
      subtitle={healthBook ? ['Медкнижка', healthSummary(healthBook)] : unavailable ? ['Часть документов недоступна'] : []}
    >
      <View style={[styles.detailBody, styles.groupGap]}>
        {healthBook?.items && <HealthBookChecks items={healthBook.items} appearance={appearance} />}
        {materials.length > 0 && (
          <View>
            <Text style={styles.groupTitle}>Материалы для курьера</Text>
            <View style={styles.materials}>
              {materials.map(({id, name, url}) => {
                if (!url || !/^https?:\/\//i.test(url)) {
                  return <Text key={id} style={styles.muted}>{name}</Text>
                }
                return (
                  <ActionRow
                    key={id}
                    appearance={appearance}
                    label={name}
                    external
                    onPress={() => {
                      void Linking.openURL(url).catch(() => Alert.alert('Не удалось открыть ссылку.'))
                    }}
                  />
                )
              })}
            </View>
          </View>
        )}
        {clothes.length > 0 && (
          <View>
            <Text style={styles.groupTitle}>Выданная форма</Text>
            <Text style={styles.muted}>{clothes.map(({name}) => name).join(' · ')}</Text>
          </View>
        )}
        {unavailable && <Text style={styles.muted}>Часть документов недоступна.</Text>}
      </View>
    </ExpandableCard>
  )
}

function PromoRow({promo, appearance}: {promo: CabinetPromo; appearance: Appearance}) {
  const {styles, colors} = appearance
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const timing = formatPromoTiming(promo)

  useEffect(() => {
    if (copyStatus === 'idle') return
    const timeout = setTimeout(() => setCopyStatus('idle'), 1800)
    return () => clearTimeout(timeout)
  }, [copyStatus])

  function copyCode() {
    try {
      Clipboard.setString(promo.code)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  const Icon = copyStatus === 'copied' ? Check : copyStatus === 'error' ? CircleAlert : Copy
  const label = copyStatus === 'copied' ? 'Промокод скопирован'
    : copyStatus === 'error' ? 'Не удалось скопировать промокод' : 'Скопировать промокод'

  return (
    <View style={styles.promo}>
      <View style={styles.promoHeader}>
        <Text selectable style={[styles.promoCode, styles.flexText]}>{promo.code}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={copyCode}
          activeOpacity={0.7}
          style={styles.copyButton}
        >
          <Icon color={colors.primary} size={21} />
        </TouchableOpacity>
      </View>
      {promo.uses_left <= 0 && <Text style={styles.muted}>Использован</Text>}
      {Boolean(promo.description) && <Text style={styles.body}>{promo.description}</Text>}
      {Boolean(promo.conditions) && <Text style={styles.body}>{promo.conditions}</Text>}
      {Boolean(timing) && <Text style={styles.muted}>{timing}</Text>}
    </View>
  )
}

function MarkerCard({appearance, onNavigate}: Pick<CabinetContentProps, 'onNavigate'> & {appearance: Appearance}) {
  const {styles, colors, isDark, font} = appearance
  const [theme, mapScale] = useGlobalStore(useShallow((state) => [state.theme, state.mapScale]))
  const [format, driverColor] = useSettingsStore(useShallow((state) => [state.type_data_map, state.color]))
  const resolvedTheme = resolveMarkerTheme(theme ?? 'white', isDark)
  const isClassic = resolvedTheme === 'classic'
  const scale = isClassic || !Number.isFinite(mapScale) ? 1 : Math.min(1.3, Math.max(0.5, mapScale))
  const color = driverColor?.trim() || colors.textMuted
  const size = Math.round(20 * scale)
  return (
    <View style={styles.card}>
      <SectionTitle appearance={appearance} Icon={MapPin} title="Твоя метка на карте" />
      <View style={styles.markerArea}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {isClassic ? (
            <>
              <Circle cx={12} cy={12} r={8} fill="none" stroke={color} strokeWidth={2} />
              <Circle cx={12} cy={12} r={3} fill={color} />
            </>
          ) : (
            <Path
              fill={color}
              d="M11.969 2c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.47 10-10-4.47-10-10-10m.03 14.23c-2.34 0-4.23-1.89-4.23-4.23s1.89-4.23 4.23-4.23 4.23 1.89 4.23 4.23-1.89 4.23-4.23 4.23"
            />
          )}
        </Svg>
        <View style={styles.markerLabel}>
          <MarkerText theme={resolvedTheme} text={cabinetMarkerLabel(format)} globalFontSize={Math.round(font * scale)} />
        </View>
      </View>
      <ActionRow appearance={appearance} label="Настройки" settings onPress={() => onNavigate('Settings')} />
    </View>
  )
}

export function CabinetContent({
  fullName, data, photoUrl, onPhotoLoad, onPhotoError, onNavigate, sections, offline, notice, hidden,
}: CabinetContentProps) {
  const {colors, isDark} = useAppTheme()
  const [font, showStatistics] = useGlobalStore(
    useShallow((state) => [state.globalFontSize, state.is_need_page_stat]),
  )
  const styles = useMemo(() => createCabinetStyles(colors, font), [colors, font])
  const appearance = {colors, isDark, font, styles}

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={hidden ? {opacity: 0} : undefined}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      pointerEvents={hidden ? 'none' : 'auto'}
    >
      <View style={[styles.card, styles.identity]}>
        <View style={styles.avatar}>
          {photoUrl ? (
            <Image
              source={{uri: photoUrl}}
              style={styles.photo}
              accessibilityLabel="Фото сотрудника"
              testID="cabinet-photo"
              onLoad={onPhotoLoad}
              onError={onPhotoError}
            />
          ) : <UserRound color={colors.primary} size={28} />}
        </View>
        <View style={styles.identityText}>
          <Text style={styles.name}>{fullName ?? 'Профиль курьера'}</Text>
          {data?.appointment_name && <Text style={styles.body}>{data.appointment_name}</Text>}
          {data?.workplace_name && <Text style={styles.muted}>{data.workplace_name}</Text>}
        </View>
      </View>

      {data && <ProfileCard {...{data, appearance, fullName}} expansion={sections.profile} />}
      {offline && sections.profile.expanded && (
        <View style={styles.card}>
          <SectionTitle appearance={appearance} Icon={UserRound} title="Профиль" />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.title}>Рабочие разделы</Text>
        <View style={styles.workRows}>
          {workLinks.filter(({target}) => target !== 'Statistics' || showStatistics).map(({target, label, Icon}) => (
            <ActionRow key={target} {...{appearance, label, Icon}} onPress={() => onNavigate(target)} />
          ))}
        </View>
      </View>

      {notice && <Text style={[styles.card, styles.muted]}>{notice}</Text>}
      {data && <DocumentsCard {...{data, appearance}} expansion={sections.documents} />}
      {offline && sections.documents.expanded && (
        <View style={styles.card}>
          <SectionTitle appearance={appearance} Icon={FileText} title="Документы и допуски" />
        </View>
      )}
      {Boolean(data?.promos.length) && (
        <View style={styles.card}>
          <SectionTitle appearance={appearance} Icon={Tag} title="Промокоды" />
          <View style={styles.promoList}>
            {data?.promos.map((promo) => <PromoRow key={promo.id} {...{promo, appearance}} />)}
          </View>
        </View>
      )}
      {data?.unavailable.includes('promos') && (
        <Text style={[styles.card, styles.muted]}>Не удалось загрузить промокоды.</Text>
      )}
      <MarkerCard {...{appearance, onNavigate}} />
    </ScrollView>
  )
}
