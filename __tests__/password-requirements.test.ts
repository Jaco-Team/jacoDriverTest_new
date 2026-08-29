import {
  getPasswordRequirements,
  isPasswordStrong,
  stripPasswordSpaces,
} from '@/shared/lib/passwordRequirements';

describe('правила пароля для восстановления доступа', () => {
  it('проверяет длину, цифру и латинские буквы обоих регистров отдельно', () => {
    expect(getPasswordRequirements('password')).toEqual([
      { label: 'Не менее 8 символов', met: true },
      { label: 'Хотя бы одна цифра', met: false },
      { label: 'Строчная латинская буква', met: true },
      { label: 'Заглавная латинская буква', met: false },
    ]);

    expect(isPasswordStrong('Password1')).toBe(true);
    expect(isPasswordStrong('PASSWORD1')).toBe(false);
    expect(isPasswordStrong('Password')).toBe(false);
    expect(isPasswordStrong('Pass1')).toBe(false);
  });

  it('удаляет пробелы перед сохранением пароля в состоянии формы', () => {
    expect(stripPasswordSpaces(' Pass word 1 ')).toBe('Password1');
  });
});
