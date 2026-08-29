export interface PasswordRequirement {
  label: string
  met: boolean
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'Не менее 8 символов', met: password.length >= 8 },
    { label: 'Хотя бы одна цифра', met: /\d/.test(password) },
    { label: 'Строчная латинская буква', met: /[a-z]/.test(password) },
    { label: 'Заглавная латинская буква', met: /[A-Z]/.test(password) },
  ]
}

export function isPasswordStrong(password: string): boolean {
  return getPasswordRequirements(password).every((requirement) => requirement.met)
}

export function stripPasswordSpaces(value: string): string {
  return value.replaceAll(' ', '')
}
