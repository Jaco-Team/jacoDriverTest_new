import { formatCountdown, maskPhone, parsePhoneInput } from '@/shared/lib/phoneInput';

describe('phone input, the same parsing as on the SSO login page', () => {
  it('formats +7 and 8 numbers as the driver types', () => {
    expect(parsePhoneInput('9')).toEqual({ display: '+7 (9', apiValue: '+79', valid: false });
    expect(parsePhoneInput('79991234567')).toEqual({
      display: '+7 (999) 123-45-67',
      apiValue: '+79991234567',
      valid: true,
    });
    expect(parsePhoneInput('8 999 123 45 67')).toEqual({
      display: '8 (999) 123-45-67',
      apiValue: '89991234567',
      valid: true,
    });
    expect(parsePhoneInput('+7 (999) 123-45-6')).toMatchObject({ valid: false });
  });

  it('keeps foreign and overlong numbers visible but invalid', () => {
    expect(parsePhoneInput('')).toEqual({ display: '', apiValue: '', valid: false });
    expect(parsePhoneInput('+3801234')).toMatchObject({ display: '+3801234', valid: false });
    expect(parsePhoneInput('799912345678')).toMatchObject({ valid: false });
    // Номер должен начинаться с 9 после кода страны.
    expect(parsePhoneInput('+7 (499) 123-45-67')).toMatchObject({ valid: false });
  });

  it('masks the number for the code step and formats the countdown', () => {
    expect(maskPhone('+7 (999) 123-45-67')).toBe('+7 (999) ***-**-67');
    expect(maskPhone('8 (999) 123-45-67')).toBe('8 (999) ***-**-67');
    expect(formatCountdown(29.2)).toBe('0:30');
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});
