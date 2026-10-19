import type { TFunction } from 'i18next';
import de from '@/i18n/de.json';
import type { ValidationMessageKey } from '@/platform/auth/schemas';

const VALIDATION_KEYS = new Set<string>(
  Object.keys(de.auth.validation).map((key) => `auth.validation.${key}`),
);

function isValidationMessageKey(value: string): value is ValidationMessageKey {
  return VALIDATION_KEYS.has(value);
}

/** Translates a schema message (an i18n key) for display; unknown messages get a generic text. */
export function translateValidationMessage(
  t: TFunction,
  message: string | undefined,
): string | undefined {
  if (message === undefined || message === '') return undefined;
  return isValidationMessageKey(message) ? t(message) : t('errors.invalidInput');
}
