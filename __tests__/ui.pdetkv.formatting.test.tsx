// __tests__/ui.pdetkv.formatting.test.tsx
/**
 * Назначение:
 *   Гарантирует, что Pd/Et/Kv показывают только непустые значения
 *   и запятые расставляются строго между блоками.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PdEtKv } from '@/entities/CardOrder/ui/PdEtKv';

const textStyle = { fontSize: 16 } as const;

test('пустые/нулевые поля скрыты, запятая только между блоками', () => {
  const item = { pd: '1', et: '', kv: '45' } as any;

  render(<PdEtKv item={item} textStyle={textStyle} />);

  // Контейнер есть
  expect(screen.getByTestId('pdetkv')).toBeTruthy();

  // Пд виден (и его значение)
  expect(screen.getByTestId('pdetkv-pd')).toBeTruthy();
  expect(screen.getByTestId('pdetkv-pd-value')).toBeTruthy();

  // Эт отсутствует полностью
  expect(screen.queryByTestId('pdetkv-et')).toBeNull();
  expect(screen.queryByTestId('pdetkv-et-value')).toBeNull();

  // Кв виден (и его значение)
  expect(screen.getByTestId('pdetkv-kv')).toBeTruthy();
  expect(screen.getByTestId('pdetkv-kv-value')).toBeTruthy();

  // Между двумя блоками — ровно один разделитель
  expect(screen.getAllByTestId('pdetkv-sep')).toHaveLength(1);
});
