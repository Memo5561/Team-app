import { describe, expect, it } from 'vitest';
import de from '@/i18n/de.json';
import {
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  normalizeDisplayName,
  resetPasswordSchema,
  signUpSchema,
} from '@/platform/auth/schemas';

/** First message per field, like react-hook-form shows it. */
function firstErrors(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  const errors: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) {
    const key = issue.path.join('.');
    errors[key] ??= issue.message;
  }
  return errors;
}

describe('emailSchema', () => {
  it('trims and lower-cases', () => {
    expect(emailSchema.parse('  Anna.Muster@Example.COM ')).toBe('anna.muster@example.com');
  });

  it.each([
    ['', 'auth.validation.emailRequired'],
    ['   ', 'auth.validation.emailRequired'],
    ['anna', 'auth.validation.emailInvalid'],
    ['anna@', 'auth.validation.emailInvalid'],
    ['anna@example', 'auth.validation.emailInvalid'],
  ])('rejects %j with %s', (value, message) => {
    expect(firstErrors(emailSchema.safeParse(value))['']).toBe(message);
  });
});

describe('signUpSchema', () => {
  const valid = { displayName: 'Anna Muster', email: 'anna@example.com' };

  it('asks for name and e-mail only', () => {
    expect(signUpSchema.parse(valid)).toEqual(valid);
  });

  it('never passes a password on (E-46: it is set after the confirmation)', () => {
    expect(signUpSchema.parse({ ...valid, password: 'ein sicheres Passwort' })).toEqual(valid);
  });

  it('normalizes the name like the database does', () => {
    expect(signUpSchema.parse({ ...valid, displayName: '  Anna \t\n  Muster ' }).displayName).toBe(
      'Anna Muster',
    );
    expect(normalizeDisplayName('A\u0000\u0007B')).toBe('A B');
  });

  it.each([
    ['', 'auth.validation.nameRequired'],
    [' \t\n ', 'auth.validation.nameRequired'],
    ['x'.repeat(101), 'auth.validation.nameTooLong'],
  ])('rejects the name %j', (displayName, message) => {
    expect(firstErrors(signUpSchema.safeParse({ ...valid, displayName })).displayName).toBe(
      message,
    );
  });

  it('counts the 100 name characters as code points', () => {
    expect(signUpSchema.safeParse({ ...valid, displayName: '😀'.repeat(100) }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...valid, displayName: `${'x'.repeat(98)}   y` }).success).toBe(
      true,
    );
  });

  it('validates the e-mail address', () => {
    expect(firstErrors(signUpSchema.safeParse({ ...valid, email: 'anna@' })).email).toBe(
      'auth.validation.emailInvalid',
    );
  });
});

describe('loginSchema', () => {
  it('requires e-mail and password but no password rules', () => {
    expect(firstErrors(loginSchema.safeParse({ email: '', password: '' }))).toEqual({
      email: 'auth.validation.emailRequired',
      password: 'auth.validation.passwordRequired',
    });
    expect(loginSchema.parse({ email: 'A@B.at', password: 'short' })).toEqual({
      email: 'a@b.at',
      password: 'short',
    });
  });
});

describe('forgotPasswordSchema', () => {
  it('validates the e-mail address', () => {
    expect(firstErrors(forgotPasswordSchema.safeParse({ email: 'x' })).email).toBe(
      'auth.validation.emailInvalid',
    );
  });
});

describe('resetPasswordSchema', () => {
  it.each([
    [{ password: '', confirmPassword: '' }, 'password', 'auth.validation.newPasswordRequired'],
    [
      { password: 'short', confirmPassword: 'short' },
      'password',
      'auth.validation.passwordTooShort',
    ],
    [
      { password: '0123456789', confirmPassword: '' },
      'confirmPassword',
      'auth.validation.confirmPasswordRequired',
    ],
    [
      { password: '0123456789', confirmPassword: '0123456780' },
      'confirmPassword',
      'auth.validation.passwordMismatch',
    ],
  ])('rejects %j (%s: %s)', (values, field, message) => {
    expect(firstErrors(resetPasswordSchema.safeParse(values))[field]).toBe(message);
  });

  it('accepts matching passwords', () => {
    expect(
      resetPasswordSchema.parse({ password: '0123456789', confirmPassword: '0123456789' }),
    ).toEqual({ password: '0123456789', confirmPassword: '0123456789' });
  });

  const both = (password: string) => ({ password, confirmPassword: password });

  it.each([
    ['123456789', 'auth.validation.passwordTooShort'],
    ['ü'.repeat(37), 'auth.validation.passwordTooLong'], // 74 bytes in UTF-8
    ['a'.repeat(73), 'auth.validation.passwordTooLong'],
  ])('rejects the password %j', (password, message) => {
    expect(firstErrors(resetPasswordSchema.safeParse(both(password))).password).toBe(message);
  });

  it('accepts passwords from 10 characters up to 72 bytes and never trims them', () => {
    expect(resetPasswordSchema.parse(both(' 123456789')).password).toBe(' 123456789');
    expect(resetPasswordSchema.safeParse(both('a'.repeat(72))).success).toBe(true);
    expect(resetPasswordSchema.safeParse(both('ü'.repeat(36))).success).toBe(true);
  });
});

describe('validation messages', () => {
  it('are i18n keys with German text', () => {
    for (const key of Object.keys(de.auth.validation)) {
      expect(de.auth.validation[key as keyof typeof de.auth.validation]).toMatch(/\S/);
    }
  });
});
