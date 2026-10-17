import {
  DEFAULT_GLOBAL_FONT_SIZE,
  MAX_GLOBAL_FONT_SIZE,
  MIN_GLOBAL_FONT_SIZE,
  normalizeGlobalFontSize,
  scaleGlobalFontSize,
} from '@/shared/lib/fontSize';

describe('global font size', () => {
  it('использует диапазон 10–26 и стандартное значение 16', () => {
    expect(MIN_GLOBAL_FONT_SIZE).toBe(10);
    expect(DEFAULT_GLOBAL_FONT_SIZE).toBe(16);
    expect(MAX_GLOBAL_FONT_SIZE).toBe(26);
  });

  it.each([
    [9, 10],
    [10, 10],
    [16, 16],
    [22, 22],
    [26, 26],
    [27, 26],
    [40, 26],
    ['22px', 22],
    ['invalid', 16],
  ])('нормализует %p в %p', (value, expected) => {
    expect(normalizeGlobalFontSize(value)).toBe(expected);
  });

  it.each([
    [16, 16, 16],
    [20, 16, 20],
    [20, 22, 26],
    [20, 26, 26],
    [14, 10, 10],
    [14, 26, 24],
    [20, 40, 26],
  ])(
    'масштабирует базовый размер %p при выбранном %p до %p',
    (baseSize, selectedSize, expected) => {
      expect(scaleGlobalFontSize(baseSize, selectedSize)).toBe(expected);
    },
  );

  it('сохраняет индивидуальные границы, не выходя за общий диапазон', () => {
    expect(scaleGlobalFontSize(20, 26, 18, 24)).toBe(24);
    expect(scaleGlobalFontSize(12, 10, 11, 18)).toBe(11);
  });
});
