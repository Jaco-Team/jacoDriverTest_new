import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import {Textarea, TextareaInput} from '@/components/ui/textarea';
import {appPalette} from '@/shared/styles/appPalette';

export function getGraphErrorContentBottomPadding({
  bottomInset,
  isKeyboardVisible,
  platform,
}: {
  bottomInset: number;
  isKeyboardVisible: boolean;
  platform: typeof Platform.OS;
}): number {
  if (platform === 'ios' && isKeyboardVisible) return 0;

  return bottomInset + 28;
}

export interface GraphErrorScrollHandle {
  scrollToEnd: (options?: {animated?: boolean}) => void;
}

export function GraphErrorSheetContainer({
  isOpen,
  busy,
  bottomInset,
  testPrefix,
  children,
  onClose,
  onScrollRef,
}: {
  isOpen: boolean;
  busy: boolean;
  bottomInset: number;
  testPrefix: 'graph-order-error' | 'graph-camera-error';
  children: React.ReactNode;
  onClose: () => void;
  onScrollRef: (instance: GraphErrorScrollHandle | null) => void;
}): React.JSX.Element {
  const iosMaxHeight = Dimensions.get('screen').height * 0.88;
  const iosSheetRef = React.useRef<BottomSheetModal>(null);
  const iosPresentedRef = React.useRef(false);
  const iosDismissingRef = React.useRef(false);
  const desiredOpenRef = React.useRef(isOpen);
  const [iosKeyboardVisible, setIosKeyboardVisible] = React.useState(false);
  desiredOpenRef.current = isOpen;

  React.useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;

    if (isOpen && !iosPresentedRef.current && !iosDismissingRef.current) {
      iosPresentedRef.current = true;
      iosSheetRef.current?.present();
    } else if (
      !isOpen &&
      iosPresentedRef.current &&
      !iosDismissingRef.current
    ) {
      iosDismissingRef.current = true;
      iosSheetRef.current?.dismiss();
    }

    return undefined;
  }, [isOpen]);

  React.useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;

    const showListener = Keyboard.addListener('keyboardWillShow', () => {
      setIosKeyboardVisible(true);
    });
    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setIosKeyboardVisible(false);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const closeIfAllowed = React.useCallback(() => {
    if (busy) return;

    if (Platform.OS === 'ios') Keyboard.dismiss();
    onClose();
  }, [busy, onClose]);
  const dismissIosKeyboard = React.useCallback(() => {
    if (!busy) Keyboard.dismiss();
  }, [busy]);
  const handleIosAnimate = React.useCallback(
    (_fromIndex: number, toIndex: number) => {
      if (toIndex !== -1 || iosDismissingRef.current) return;

      iosDismissingRef.current = true;
      desiredOpenRef.current = false;
      closeIfAllowed();
    },
    [closeIfAllowed],
  );
  const handleIosDismiss = React.useCallback(() => {
    iosPresentedRef.current = false;
    iosDismissingRef.current = false;

    requestAnimationFrame(() => {
      if (!desiredOpenRef.current) return;

      iosPresentedRef.current = true;
      iosSheetRef.current?.present();
    });
  }, []);
  const renderIosBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        accessibilityLabel="Закрыть модальное окно"
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={busy ? 'none' : 'close'}
        onPress={busy ? undefined : dismissIosKeyboard}>
        <View
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          testID={`${testPrefix}-backdrop`}
        />
      </BottomSheetBackdrop>
    ),
    [busy, dismissIosKeyboard, testPrefix],
  );
  const setScrollRef = (instance: unknown) => {
    onScrollRef(instance as GraphErrorScrollHandle | null);
  };
  const contentStyle = [
    graphErrorSheetStyles.content,
    {
      paddingBottom: getGraphErrorContentBottomPadding({
        bottomInset,
        isKeyboardVisible: iosKeyboardVisible,
        platform: Platform.OS,
      }),
    },
  ];

  if (Platform.OS === 'ios') {
    return (
      <BottomSheetModal
        ref={iosSheetRef}
        backdropComponent={renderIosBackdrop}
        backgroundStyle={graphErrorSheetStyles.iosSheetBackground}
        enableBlurKeyboardOnGesture
        enableDynamicSizing
        enablePanDownToClose={!busy}
        handleIndicatorStyle={graphErrorSheetStyles.handle}
        handleStyle={graphErrorSheetStyles.handleArea}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        maxDynamicContentSize={iosMaxHeight}
        onAnimate={handleIosAnimate}
        onDismiss={handleIosDismiss}>
        <BottomSheetScrollView
          ref={setScrollRef}
          contentContainerStyle={contentStyle}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          testID={`${testPrefix}-scroll`}>
          <View testID={`${testPrefix}-sheet`}>{children}</View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }

  return (
    <Actionsheet isOpen={isOpen} onClose={closeIfAllowed}>
      <ActionsheetBackdrop testID={`${testPrefix}-backdrop`} />
      <KeyboardAvoidingView
        behavior="height"
        pointerEvents="box-none"
        style={graphErrorSheetStyles.keyboardAvoiding}
        testID={`${testPrefix}-keyboard`}>
        <ActionsheetContent
          style={graphErrorSheetStyles.sheet}
          testID={`${testPrefix}-sheet`}>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator style={graphErrorSheetStyles.handleArea}>
              <View style={graphErrorSheetStyles.handle} />
            </ActionsheetDragIndicator>
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetScrollView
            ref={setScrollRef}
            contentContainerStyle={contentStyle}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            testID={`${testPrefix}-scroll`}>
            {children}
          </ActionsheetScrollView>
        </ActionsheetContent>
      </KeyboardAvoidingView>
    </Actionsheet>
  );
}

export function GraphErrorField({
  label,
  value,
  fontSize,
}: {
  label: string;
  value?: React.ReactNode;
  fontSize: number;
}): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, {fontSize}]}>{label}</Text>
      {value === '' || value === undefined ? null : (
        <Text style={[styles.fieldValue, {fontSize}]}>{` ${value}`}</Text>
      )}
    </View>
  );
}

export function GraphAppealBlock({
  text,
  canEdit,
  value,
  busy,
  fontSize,
  onChange,
  onInputFocus,
  onSubmit,
}: {
  text?: string;
  canEdit: boolean;
  value: string;
  busy: boolean;
  fontSize: number;
  onChange: (value: string) => void;
  onInputFocus?: () => void;
  onSubmit: () => void;
}): React.JSX.Element | null {
  if (text) {
    return (
      <GraphErrorField
        fontSize={fontSize}
        label="Причина обжалования:"
        value={text}
      />
    );
  }

  if (!canEdit) return null;

  return (
    <View style={styles.appeal}>
      <Text style={[styles.fieldLabel, {fontSize}]}>Причина обжалования:</Text>
      {Platform.OS === 'ios' ? (
        <BottomSheetTextInput
          editable={!busy}
          multiline
          style={[styles.bottomSheetTextareaInput, {fontSize}]}
          testID="graph-error-input"
          value={value}
          onChangeText={onChange}
          onFocus={onInputFocus}
        />
      ) : (
        <Textarea isDisabled={busy} style={styles.textarea}>
          <TextareaInput
            style={[styles.textareaInput, {fontSize}]}
            testID="graph-error-input"
            value={value}
            onChangeText={onChange}
            onFocus={onInputFocus}
          />
        </Textarea>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={[styles.submit, busy && styles.submitDisabled]}
        testID="graph-error-submit"
        onPress={onSubmit}>
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={[styles.submitText, {fontSize}]}>Обжаловать</Text>
        )}
      </Pressable>
    </View>
  );
}

export const graphErrorSheetStyles = StyleSheet.create({
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
  sheet: {
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
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  title: {
    color: '#000000',
    fontFamily: 'Roboto-Medium',
    lineHeight: 25,
  },
  images: {
    width: '100%',
    gap: 10,
    paddingTop: 10,
  },
  imageButton: {
    width: '100%',
    minHeight: 180,
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: appPalette.surfaceAlt,
  },
  image: {
    width: '100%',
    height: 220,
  },
});

const styles = StyleSheet.create({
  field: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 20,
  },
  fieldLabel: {
    color: '#000000',
    fontFamily: 'Roboto-Bold',
    lineHeight: 23,
  },
  fieldValue: {
    minWidth: 0,
    flexShrink: 1,
    color: '#000000',
    fontFamily: 'Roboto-Regular',
    lineHeight: 23,
  },
  appeal: {
    width: '100%',
    gap: 10,
    paddingTop: 20,
  },
  textarea: {
    width: '100%',
    minHeight: 80,
    borderRadius: 12,
    borderColor: appPalette.border,
  },
  textareaInput: {
    color: appPalette.text,
    fontFamily: 'Roboto-Regular',
    textAlignVertical: 'top',
  },
  bottomSheetTextareaInput: {
    width: '100%',
    height: 100,
    padding: 8,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: appPalette.border,
    color: appPalette.text,
    fontFamily: 'Roboto-Regular',
    textAlignVertical: 'top',
  },
  submit: {
    width: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: appPalette.brand,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
  },
});
