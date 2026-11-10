import { stripPasswordSpaces } from '@/shared/lib/passwordRequirements';

describe('пароль при восстановлении доступа', () => {
  it('удаляет пробелы перед сохранением пароля в состоянии формы', () => {
    expect(stripPasswordSpaces(' Pass word 1 ')).toBe('Password1');
  });
});
