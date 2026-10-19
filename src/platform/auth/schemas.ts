import { z } from 'zod';
import type de from '@/i18n/de.json';

/**
 * Form schemas for the auth flows. Messages are i18n keys (auth.validation.*); the form components
 * translate them. Rules mirror Supabase Auth and the `profiles` constraints so most problems are
 * caught before a request is sent.
 */

export type ValidationMessageKey = `auth.validation.${keyof typeof de.auth.validation}`;

const message = (key: ValidationMessageKey) => ({ message: key });

/** Minimum password length (also configured in Supabase Auth). */
export const PASSWORD_MIN_LENGTH = 10;
/** bcrypt only uses the first 72 bytes; Supabase Auth rejects longer passwords. */
export const PASSWORD_MAX_BYTES = 72;
/** Mirrors profiles_display_name_valid. */
export const DISPLAY_NAME_MAX_LENGTH = 100;

// Unicode code points, like Postgres char_length() and GoTrue's password length check.
const codePointLength = (value: string) => Array.from(value).length;
const utf8Length = (value: string) => new TextEncoder().encode(value).length;

/** Same normalization as private.normalize_display_name(): collapse whitespace/control runs, trim. */
export function normalizeDisplayName(value: string): string {
  return value.replace(/[\s\p{Cc}]+/gu, ' ').trim();
}

const displayName = z
  .string()
  .transform(normalizeDisplayName)
  .pipe(
    z
      .string()
      .min(1, message('auth.validation.nameRequired'))
      .refine(
        (value) => codePointLength(value) <= DISPLAY_NAME_MAX_LENGTH,
        message('auth.validation.nameTooLong'),
      ),
  );

/** E-mail addresses are stored trimmed and lower-cased (E-38). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, message('auth.validation.emailRequired'))
  .pipe(z.email(message('auth.validation.emailInvalid')));

/** Rules for a password that is being set. Passwords are never trimmed. */
function checkNewPassword(value: string, ctx: z.RefinementCtx) {
  if (codePointLength(value) < PASSWORD_MIN_LENGTH) {
    ctx.addIssue({ code: 'custom', ...message('auth.validation.passwordTooShort') });
  } else if (utf8Length(value) > PASSWORD_MAX_BYTES) {
    ctx.addIssue({ code: 'custom', ...message('auth.validation.passwordTooLong') });
  }
}

export const loginSchema = z.object({
  email: emailSchema,
  // Existing passwords are checked by the server only; no length rules when signing in.
  password: z.string().min(1, message('auth.validation.passwordRequired')),
});

export const magicLinkSchema = z.object({ email: emailSchema });

/** No password: it is set only after the address is confirmed (E-46). */
export const signUpSchema = z.object({ displayName, email: emailSchema });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, message('auth.validation.newPasswordRequired'))
      .superRefine(checkNewPassword),
    confirmPassword: z.string().min(1, message('auth.validation.confirmPasswordRequired')),
  })
  .refine((values) => values.password === values.confirmPassword, {
    ...message('auth.validation.passwordMismatch'),
    path: ['confirmPassword'],
  });

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
export type MagicLinkValues = z.output<typeof magicLinkSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type SignUpValues = z.output<typeof signUpSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ForgotPasswordValues = z.output<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type ResetPasswordValues = z.output<typeof resetPasswordSchema>;
