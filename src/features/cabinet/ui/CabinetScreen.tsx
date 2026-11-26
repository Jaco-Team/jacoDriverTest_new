import React, {useEffect, useState} from 'react'
import {ActivityIndicator, Modal, StyleSheet, View} from 'react-native'
import {useIsFocused, useNavigation, type NavigationProp, type ParamListBase} from '@react-navigation/native'

import {fetchLaravelCabinet, resolveCabinetPhotoUrl, type CabinetData} from '@/shared/api/laravel/cabinet'
import {useIsOffline} from '@/shared/lib/connectivityContext'
import {useGlobalStore, useLoginStore, useSettingsStore} from '@/shared/store/store'
import {ScreenLayout} from '@/shared/ui/ScreenLayout'

import {CabinetContent, type CabinetSections, type CabinetTarget} from './CabinetContent'

type CabinetNavigation = {
  fullName: string | null
  onNavigate: (target: CabinetTarget) => void
}

type CabinetSessionProps = CabinetNavigation & {
  onBack: () => void
  token: string
  isOffline: boolean
}

function OnlineCabinet({
  token, fullName, onNavigate, onBack, sections,
}: CabinetNavigation & {token: string; onBack: () => void; sections: CabinetSections}) {
  const getSettings = useSettingsStore((state) => state.getSettings)
  const [result, setResult] = useState<{token: string; data: CabinetData | null} | null>(null)
  const [photo, setPhoto] = useState<{url: string; loaded: boolean} | null>(null)

  useEffect(() => {
    const request = new AbortController()
    void Promise.allSettled([fetchLaravelCabinet(token, request.signal), getSettings(true)]).then(
      ([response]) => {
        if (request.signal.aborted) return
        setResult({token, data: response.status === 'fulfilled' ? response.value : null})
      },
    )
    return () => request.abort()
  }, [getSettings, token])

  const current = result?.token === token ? result : null
  const photoUrl = resolveCabinetPhotoUrl(current?.data?.photo_url)
  const photoNeedsLoading = photoUrl !== null && photo?.url !== photoUrl
  const loading = current === null || photoNeedsLoading

  useEffect(() => {
    if (!photoUrl || !photoNeedsLoading) return
    const timeout = setTimeout(() => setPhoto({url: photoUrl, loaded: false}), 8000)
    return () => clearTimeout(timeout)
  }, [photoNeedsLoading, photoUrl])

  return (
    <>
      {current && (
        <CabinetContent
          {...{fullName, onNavigate, sections}}
          data={current.data}
          photoUrl={photoNeedsLoading || photo?.loaded ? photoUrl : null}
          hidden={loading}
          onPhotoLoad={() => photoUrl && setPhoto({url: photoUrl, loaded: true})}
          onPhotoError={() => photoUrl && setPhoto({url: photoUrl, loaded: false})}
          notice={current.data ? undefined : 'Не удалось загрузить данные кабинета.'}
        />
      )}
      {loading && (
        <Modal
          animationType="none"
          transparent
          presentationStyle="overFullScreen"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={onBack}
        >
          <View style={styles.loading} accessibilityViewIsModal testID="cabinet-loading">
            <ActivityIndicator color="#fff" size="large" accessibilityLabel="Загружаем личный кабинет" />
          </View>
        </Modal>
      )}
    </>
  )
}

function CabinetSession({token, fullName, onNavigate, onBack, isOffline}: CabinetSessionProps) {
  const [profileExpanded, setProfileExpanded] = useState(false)
  const [documentsExpanded, setDocumentsExpanded] = useState(false)
  const sections: CabinetSections = {
    profile: {expanded: profileExpanded, onExpandedChange: setProfileExpanded},
    documents: {expanded: documentsExpanded, onExpandedChange: setDocumentsExpanded},
  }

  return (
    <ScreenLayout>
      {isOffline ? (
        <CabinetContent {...{fullName, onNavigate, sections}} offline />
      ) : token ? (
        <OnlineCabinet {...{fullName, onNavigate, token, onBack, sections}} />
      ) : (
        <CabinetContent {...{fullName, onNavigate, sections}} notice="Сессия истекла. Войдите снова." />
      )}
    </ScreenLayout>
  )
}

export function CabinetScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const isFocused = useIsFocused()
  const isOffline = useIsOffline()
  const user = useLoginStore((state) => state.currentUser)
  const token = useGlobalStore((state) => state.tokenAuth)

  if (!isFocused || !user) return null

  const fullName = user.name?.trim() || null
  const onNavigate = (target: CabinetTarget) => navigation.navigate(target)

  return (
    <CabinetSession
      key={user.user_id ?? user.login ?? ''}
      {...{fullName, onNavigate, token, isOffline}}
      onBack={navigation.goBack}
    />
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
})
