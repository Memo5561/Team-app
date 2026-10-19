import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from '@/i18n/de.json';

export const defaultNS = 'translation';
export const resources = { de: { translation: de } } as const;

// V1 ships German only (spec §66); all UI text goes through translation keys.
void i18next.use(initReactI18next).init({
  lng: 'de',
  fallbackLng: 'de',
  supportedLngs: ['de'],
  defaultNS,
  resources,
  initAsync: false,
  interpolation: { escapeValue: false }, // React already escapes rendered values.
  returnNull: false,
});

export { i18next };
