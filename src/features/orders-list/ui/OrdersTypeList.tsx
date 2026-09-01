import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Actionsheet,
  ActionsheetContent,
  ActionsheetItem,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetBackdrop,
} from '@/components/ui/actionsheet'
import { X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGlobalStore, useOrdersStore } from '@/shared/store/store';
import { useShallow } from 'zustand/react/shallow'

import { TypeOrder } from '@/shared/store/OrdersStoreType';
import { appPalette } from '@/shared/styles/appPalette';

export const OrdersTypeList: React.FC = () => {
  const [isActionSheetVisible, setActionSheetVisible] = useState(false);
  const insets = useSafeAreaInsets()

  const [globalFontSize] = useGlobalStore(
    useShallow(state => [state.globalFontSize]),
  );
  const [type, types, selectType] = useOrdersStore(useShallow(state => {
    return [state.type, state.types, state.selectType];
  }));

  const handleSelect = (item: TypeOrder) => {
    selectType(item);
    setActionSheetVisible(false);
  };

  return (
    <>
      <Pressable
        accessibilityLabel="Выбрать тип заказов"
        accessibilityRole="button"
        hitSlop={8}
        style={styles.trigger}
        testID="orders-status-trigger"
        onPress={() => setActionSheetVisible(true)}
      >
        <Text
          numberOfLines={1}
          style={[styles.triggerText, { fontSize: globalFontSize }]}
        >
          {(type ? type.text : 'Заказы').toUpperCase()}
        </Text>
      </Pressable>

      <Actionsheet
        isOpen={isActionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
      >
        <ActionsheetBackdrop />
        <ActionsheetContent
          style={styles.sheetContent}
          testID="orders-status-sheet"
        >
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator style={styles.dragIndicatorArea}>
              <View style={styles.dragIndicator} />
            </ActionsheetDragIndicator>
          </ActionsheetDragIndicatorWrapper>

          <View style={styles.sheetHeader}>
            <View style={styles.headerSide} />
            <Text style={[styles.sheetTitle, { fontSize: globalFontSize + 2 }]}>
              Список заказов
            </Text>
            <Pressable
              accessibilityLabel="Закрыть"
              accessibilityRole="button"
              hitSlop={8}
              style={styles.closeButton}
              testID="orders-status-close"
              onPress={() => setActionSheetVisible(false)}
            >
              <X color={appPalette.textMuted} size={23} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.options}>
            {types.map((item) => {
              const isSelected = type?.id === item.id

              return (
                <ActionsheetItem
                  accessibilityState={{ selected: isSelected }}
                  key={item.id}
                  style={[
                    styles.option,
                    isSelected && styles.optionSelected,
                  ]}
                  testID={`orders-status-option-${item.id}`}
                  onPress={() => handleSelect(item)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { fontSize: globalFontSize },
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {item.text}
                  </Text>
                  {isSelected ? <View style={styles.selectedDot} /> : null}
                </ActionsheetItem>
              )
            })}
          </View>

          <View style={{ height: insets.bottom + 28 }} />
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    maxWidth: '100%',
    minHeight: 44,
    justifyContent: 'center',
  },
  triggerText: {
    color: appPalette.brand,
    fontFamily: 'Roboto-Medium',
    lineHeight: 22,
  },
  sheetContent: {
    maxHeight: '75%',
    overflow: 'hidden',
    padding: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: appPalette.softStrong,
    backgroundColor: '#FFFFFF',
  },
  dragIndicatorArea: {
    width: '100%',
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dragIndicator: {
    width: 62,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(31, 43, 54, 0.20)',
  },
  sheetHeader: {
    width: '100%',
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerSide: {
    width: 44,
  },
  sheetTitle: {
    flex: 1,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
    lineHeight: 25,
    textAlign: 'center',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(31, 43, 54, 0.14)',
  },
  options: {
    width: '100%',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  option: {
    width: '100%',
    minHeight: 56,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  optionSelected: {
    backgroundColor: '#E3F2FD',
  },
  optionText: {
    width: '100%',
    color: '#333333',
    fontFamily: 'Roboto-Medium',
    lineHeight: 22,
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#1976D2',
    fontFamily: 'Roboto-Medium',
  },
  selectedDot: {
    position: 'absolute',
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
})
