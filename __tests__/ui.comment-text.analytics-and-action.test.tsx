// __tests__/ui.comment-text.analytics-and-action.test.tsx
/**
 * Назначение:
 *   Проверяет логику CommentText:
 *   • есть номер → звонок + событие аналитики, иконка Copy видна
 *   • нет номера → копирование в буфер + алёрт + другое событие аналитики
 *
 * Зачем:
 *   Это быстрый контакт/копипаст из комментария; регресс ломает UX и аналитику.
 */

/* ===== ЛОКАЛЬНЫЕ МОКИ UI-КОМПОНЕНТОВ (убирают "type is invalid") ===== */
jest.mock('@/components/ui/hstack', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { HStack: ({ children, ...p }: any) => React.createElement(View, p, children) };
});
jest.mock('@/components/ui/text', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Text: ({ children, ...p }: any) => React.createElement(Text, p, children) };
});
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Mk = (name: string) => (props: any) => React.createElement(View, { ...props, testID: name });
  return { Copy: Mk('Copy'), QrCode: Mk('QrCode') };
});

/* ===== СИСТЕМНЫЕ МОКИ (Clipboard/Analytics/парсеры) ===== */
jest.mock('@react-native-clipboard/clipboard', () => ({ setString: jest.fn() }));
jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: jest.fn() },
  AnalyticsEvent: { OrderCallClient: 'OrderCallClient', OrderClipboard: 'OrderClipboard' },
}));
jest.mock('@/shared/lib/getNumberComment', () => ({
  // Для тестов возвращаем как есть
  getNumberComment: (s: string) => s,
}));
jest.mock('@/shared/lib/getNumberCommentCheck', () => ({
  // Считаем, что "есть номер", если встречаем префикс "tel:"
  getNumberCommentCheck: (s: string) => (s.includes('tel:') ? ['+7'] : []),
}));

/* ===== ТЕСТЫ ===== */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CommentText } from '@/entities/CardOrder/ui/CommentText';
import Clipboard from '@react-native-clipboard/clipboard';

test('есть номер: звонок, иконка Copy видна, логируется OrderCallClient', () => {
  const dialCall = jest.fn();
  const { Analytics } = require('@/analytics/AppMetricaService');

  render(
    <CommentText
      comment="tel:+79990000000"
      showAlertText={jest.fn()}
      globalFontSize={16}
      dialCall={dialCall}
    />
  );

  // Иконка есть
  expect(screen.getByTestId('Copy')).toBeTruthy();

  // Нажимаем по тексту блока комментария
  fireEvent.press(screen.getByTestId('comment-touch'));

  // Вызван звонок и корректная аналитика
  expect(dialCall).toHaveBeenCalledWith('tel:+79990000000');
  expect(Analytics.log).toHaveBeenCalledWith('OrderCallClient', 'Звонок клиенту из комментария');
});

test('нет номера: копирование и алерт, логируется OrderClipboard; иконки Copy нет', () => {
  const showAlertText = jest.fn();
  const dialCall = jest.fn();
  const { Analytics } = require('@/analytics/AppMetricaService');

  render(
    <CommentText
      comment="без телефона"
      showAlertText={showAlertText}
      globalFontSize={16}
      dialCall={dialCall}
    />
  );

  // Иконки нет
  expect(screen.queryByTestId('Copy')).toBeNull();

  // Нажимаем по тексту блока комментария
  fireEvent.press(screen.getByTestId('comment-touch'));

  // Скопировано в буфер, показан алерт, звонка нет, аналитика корректная
  expect(Clipboard.setString).toHaveBeenCalledWith('без телефона');
  expect(showAlertText).toHaveBeenCalledWith(true, 'Скопировано');
  expect(dialCall).not.toHaveBeenCalled();
  expect(Analytics.log).toHaveBeenCalledWith('OrderClipboard', 'Копирование комментария из заказа');
});

