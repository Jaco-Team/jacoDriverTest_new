import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

const mockSubmitOrder = jest.fn();
const mockSubmitCamera = jest.fn();
const mockCloseOrder = jest.fn();
const mockCloseCamera = jest.fn();
const mockIosSheetPresent = jest.fn();
const mockIosSheetDismiss = jest.fn();

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const {Pressable, ScrollView, TextInput, View} = require('react-native');
  const BottomSheetModal = React.forwardRef(
    ({backdropComponent: Backdrop, children, ...props}: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        present: mockIosSheetPresent,
        dismiss: mockIosSheetDismiss,
      }));

      return React.createElement(
        View,
        {testID: 'mock-ios-bottom-sheet', ...props},
        Backdrop
          ? React.createElement(Backdrop, {
              animatedIndex: {value: 0},
              animatedPosition: {value: 0},
            })
          : null,
        children,
      );
    },
  );

  return {
    __esModule: true,
    BottomSheetBackdrop: ({children, onPress, ...props}: any) =>
      React.createElement(Pressable, {...props, onPress}, children),
    BottomSheetModal,
    BottomSheetScrollView: React.forwardRef((props: any, ref: any) =>
      React.createElement(ScrollView, {...props, ref}, props.children),
    ),
    BottomSheetTextInput: TextInput,
  };
});

jest.mock('@/features/schedule/model/useErrorModal', () => ({
  useErrorOrders: () => ({
    isShowModalErrOrder: true,
    modalErrOrder: {
      order_id: 100,
      date_time_order: '30.08.2026 12:00',
      order_desc: 'Опоздание',
      item_name: 'Роллы',
      pr_name: 'Время доставки',
      my_price: 300,
      imgs: [],
      new_text_1: '',
      new_text_2: '',
      is_edit: 1,
    },
    FormatPrice: (value: number) => String(value),
    isSubmitting: false,
    globalFontSize: 16,
    visible: false,
    setVisible: jest.fn(),
    indexImg: 0,
    transformedArray: [],
    errorText: '',
    setTextError: jest.fn(),
    closeModal: mockCloseOrder,
    openImage: jest.fn(),
    submitError: mockSubmitOrder,
  }),
  useErrorCamera: () => ({
    isShowModalErrCam: true,
    modalErrCam: {
      id: 200,
      date_time_fine: '30.08.2026 13:00',
      fine_name: 'Камера',
      price: 250,
      imgs: [],
      text_one: '',
      text_two: '',
      is_edit: 1,
    },
    FormatPrice: (value: number) => String(value),
    isSubmitting: false,
    globalFontSize: 16,
    visible: false,
    setVisible: jest.fn(),
    indexImg: 0,
    transformedArray: [],
    errorText: '',
    setTextError: jest.fn(),
    closeModal: mockCloseCamera,
    openImage: jest.fn(),
    onSubmitError: mockSubmitCamera,
  }),
}));

jest.mock('@/components/ui/actionsheet', () => {
  const React = require('react');
  const {ScrollView, View} = require('react-native');
  return {
    Actionsheet: ({children, isOpen}: any) =>
      isOpen ? React.createElement(View, null, children) : null,
    ActionsheetBackdrop: View,
    ActionsheetContent: View,
    ActionsheetDragIndicator: View,
    ActionsheetDragIndicatorWrapper: View,
    ActionsheetScrollView: ScrollView,
  };
});

jest.mock('react-native-image-viewing', () => () => null);

jest.mock('@/components/ui/textarea', () => {
  const React = require('react');
  const {TextInput, View} = require('react-native');
  return {
    Textarea: ({children, ...props}: any) =>
      React.createElement(View, props, children),
    TextareaInput: (props: any) => React.createElement(TextInput, props),
  };
});

import {ModalErrCam} from '@/features/schedule/ui/ModalErrCam';
import {ModalErrOrder} from '@/features/schedule/ui/ModalErrOrder';
import {getGraphErrorContentBottomPadding} from '@/features/schedule/ui/GraphErrorSheetParts';

const metrics = {
  frame: {x: 0, y: 0, width: 390, height: 844},
  insets: {top: 47, right: 0, bottom: 34, left: 0},
};

describe('нижние шторки ошибок графика', () => {
  beforeEach(() => jest.clearAllMocks());

  it('убирает нижний Safe Area только при открытой клавиатуре iOS', () => {
    expect(
      getGraphErrorContentBottomPadding({
        bottomInset: 34,
        isKeyboardVisible: true,
        platform: 'ios',
      }),
    ).toBe(0);
    expect(
      getGraphErrorContentBottomPadding({
        bottomInset: 34,
        isKeyboardVisible: false,
        platform: 'ios',
      }),
    ).toBe(62);
    expect(
      getGraphErrorContentBottomPadding({
        bottomInset: 24,
        isKeyboardVisible: true,
        platform: 'android',
      }),
    ).toBe(52);
  });

  it('показывает все поля ошибки заказа и сохраняет обжалование', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ModalErrOrder />
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId('mock-ios-bottom-sheet')).toHaveProp(
      'enablePanDownToClose',
      true,
    );
    expect(screen.getByTestId('mock-ios-bottom-sheet')).toHaveProp(
      'enableBlurKeyboardOnGesture',
      true,
    );
    expect(screen.getByTestId('mock-ios-bottom-sheet')).toHaveProp(
      'keyboardBehavior',
      'interactive',
    );
    expect(screen.getByTestId('mock-ios-bottom-sheet')).toHaveProp(
      'keyboardBlurBehavior',
      'restore',
    );
    expect(screen.getByTestId('mock-ios-bottom-sheet')).toHaveProp(
      'backgroundStyle',
      expect.objectContaining({
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }),
    );
    expect(screen.getByText('Ошибка по заказу №100')).toBeTruthy();
    expect(screen.getByText(' Роллы')).toBeTruthy();
    expect(screen.getByText(' Время доставки')).toBeTruthy();
    expect(screen.getByText(' 300₽')).toBeTruthy();
    expect(
      screen.queryByPlaceholderText('Что произошло на самом деле?'),
    ).toBeNull();
    expect(screen.getByTestId('graph-error-input')).toHaveStyle({
      textAlignVertical: 'top',
    });

    await fireEvent.press(screen.getByTestId('graph-error-submit'));
    expect(mockSubmitOrder).toHaveBeenCalledTimes(1);
    fireEvent(
      screen.getByTestId('mock-ios-bottom-sheet'),
      'animate',
      0,
      -1,
      0,
      500,
    );
    expect(mockCloseOrder).toHaveBeenCalledTimes(1);
  });

  it('показывает ошибку камеры в такой же нижней шторке', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ModalErrCam />
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId('mock-ios-bottom-sheet')).toHaveProp(
      'enablePanDownToClose',
      true,
    );
    expect(screen.getByTestId('mock-ios-bottom-sheet')).toHaveProp(
      'enableBlurKeyboardOnGesture',
      true,
    );
    expect(screen.getByText('Ошибка №200')).toBeTruthy();
    expect(screen.getByText(' Камера')).toBeTruthy();
    expect(
      screen.queryByPlaceholderText('Что произошло на самом деле?'),
    ).toBeNull();
    expect(screen.getByTestId('graph-error-input')).toHaveStyle({
      textAlignVertical: 'top',
    });

    await fireEvent.press(screen.getByTestId('graph-error-submit'));
    expect(mockSubmitCamera).toHaveBeenCalledTimes(1);
    fireEvent(
      screen.getByTestId('mock-ios-bottom-sheet'),
      'animate',
      0,
      -1,
      0,
      500,
    );
    expect(mockCloseCamera).toHaveBeenCalledTimes(1);
  });
});
