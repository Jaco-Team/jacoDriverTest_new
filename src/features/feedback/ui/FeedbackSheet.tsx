import React from 'react'
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet'
import { appPalette } from '@/shared/styles/appPalette'

type FeedbackSheetProps = {
  isOpen: boolean
  busy?: boolean
  testID: string
  children: React.ReactNode
  onClose: () => void
}

export function FeedbackSheet({
  isOpen,
  busy = false,
  testID,
  children,
  onClose,
}: FeedbackSheetProps): React.JSX.Element {
  const { bottom } = useSafeAreaInsets()
  const iosSheetRef = React.useRef<BottomSheetModal>(null)
  const iosPresentedRef = React.useRef(false)
  const iosDismissingRef = React.useRef(false)
  const desiredOpenRef = React.useRef(isOpen)
  const [iosKeyboardVisible, setIosKeyboardVisible] = React.useState(false)
  const maxHeight = Dimensions.get('screen').height * 0.88

  desiredOpenRef.current = isOpen

  React.useEffect(() => {
    if (Platform.OS !== 'ios') return undefined

    if (isOpen && !iosPresentedRef.current && !iosDismissingRef.current) {
      iosPresentedRef.current = true
      iosSheetRef.current?.present()
    } else if (!isOpen && iosPresentedRef.current && !iosDismissingRef.current) {
      iosDismissingRef.current = true
      iosSheetRef.current?.dismiss()
    }

    return undefined
  }, [isOpen])

  React.useEffect(() => {
    if (Platform.OS !== 'ios') return undefined

    const showListener = Keyboard.addListener('keyboardWillShow', () => {
      setIosKeyboardVisible(true)
    })
    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setIosKeyboardVisible(false)
    })

    return () => {
      showListener.remove()
      hideListener.remove()
    }
  }, [])

  const closeIfAllowed = React.useCallback(() => {
    if (busy) return

    Keyboard.dismiss()
    onClose()
  }, [busy, onClose])

  const dismissKeyboard = React.useCallback(() => {
    if (!busy) Keyboard.dismiss()
  }, [busy])

  const handleIosAnimate = React.useCallback(
    (_fromIndex: number, toIndex: number) => {
      if (toIndex !== -1 || iosDismissingRef.current) return

      iosDismissingRef.current = true
      desiredOpenRef.current = false
      closeIfAllowed()
    },
    [closeIfAllowed],
  )

  const handleIosDismiss = React.useCallback(() => {
    iosPresentedRef.current = false
    iosDismissingRef.current = false

    requestAnimationFrame(() => {
      if (!desiredOpenRef.current) return

      iosPresentedRef.current = true
      iosSheetRef.current?.present()
    })
  }, [])

  const renderIosBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        accessibilityLabel="Закрыть модальное окно"
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={busy ? 'none' : 'close'}
        onPress={busy ? undefined : dismissKeyboard}
      />
    ),
    [busy, dismissKeyboard],
  )

  const contentStyle = [
    styles.content,
    {
      paddingBottom: Platform.OS === 'ios' && iosKeyboardVisible ? 0 : bottom + 18,
    },
  ]

  if (Platform.OS === 'ios') {
    return (
      <BottomSheetModal
        ref={iosSheetRef}
        backdropComponent={renderIosBackdrop}
        backgroundStyle={styles.iosSheetBackground}
        enableBlurKeyboardOnGesture
        enableDynamicSizing
        enablePanDownToClose={!busy}
        handleIndicatorStyle={styles.handle}
        handleStyle={styles.handleArea}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        maxDynamicContentSize={maxHeight}
        onAnimate={handleIosAnimate}
        onDismiss={handleIosDismiss}
      >
        <BottomSheetScrollView
          contentContainerStyle={contentStyle}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          testID={`${testID}-scroll`}
        >
          <View testID={testID}>{children}</View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    )
  }

  return (
    <Actionsheet isOpen={isOpen} onClose={closeIfAllowed}>
      <ActionsheetBackdrop testID={`${testID}-backdrop`} />
      <KeyboardAvoidingView
        behavior="height"
        pointerEvents="box-none"
        style={styles.keyboardAvoiding}
      >
        <ActionsheetContent style={styles.androidSheet} testID={testID}>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator style={styles.handleArea}>
              <View style={styles.handle} />
            </ActionsheetDragIndicator>
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetScrollView
            contentContainerStyle={contentStyle}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            testID={`${testID}-scroll`}
          >
            {children}
          </ActionsheetScrollView>
        </ActionsheetContent>
      </KeyboardAvoidingView>
    </Actionsheet>
  )
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
    width: '100%',
  },
  iosSheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#FFFFFF',
  },
  androidSheet: {
    maxHeight: '88%',
    overflow: 'hidden',
    padding: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: appPalette.softStrong,
    backgroundColor: '#FFFFFF',
  },
  handleArea: {
    width: '100%',
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(31, 43, 54, 0.2)',
  },
  content: {
    paddingHorizontal: 20,
  },
})
