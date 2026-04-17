import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './locales/en';

export type AppLanguage = 'system' | 'en' | 'hi';

export const LANGUAGE_OPTIONS: { key: AppLanguage; label: string; nativeLabel: string }[] = [
  { key: 'system', label: 'System Default', nativeLabel: 'System' },
  { key: 'en', label: 'English', nativeLabel: 'English' },
  { key: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
];

/** Resolve the device's preferred language to one we support, falling back to 'en'. */
export function getDeviceLanguage(): 'en' | 'hi' {
  const locales = getLocales();
  if (!locales.length) return 'en';
  const tag = locales[0].languageCode ?? 'en';
  return tag === 'hi' ? 'hi' : 'en';
}

/** Resolve user preference ('system' | 'en' | 'hi') to an actual language code. */
export function resolveLanguage(pref: AppLanguage): 'en' | 'hi' {
  if (pref === 'en' || pref === 'hi') return pref;
  return getDeviceLanguage();
}

/** Lazily load a language bundle and add it to i18next. */
async function loadLanguage(lng: string): Promise<void> {
  if (i18n.hasResourceBundle(lng, 'translation')) return;
  if (lng !== 'hi') return;
  const resources = (await import('./locales/hi')).default;
  i18n.addResourceBundle(lng, 'translation', resources);
}

const deviceLang = getDeviceLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: deviceLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

// Load non-English device language eagerly (but async to avoid blocking startup)
if (deviceLang !== 'en') {
  loadLanguage(deviceLang);
}

/** Change the active language, loading the bundle if needed. */
export async function changeLanguage(lng: string): Promise<void> {
  await loadLanguage(lng);
  await i18n.changeLanguage(lng);
}

export default i18n;
