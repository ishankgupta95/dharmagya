import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './locales/en';

export type AppLanguage = 'system' | 'en' | 'hi' | 'sa';

export const LANGUAGE_OPTIONS: { key: AppLanguage; label: string; nativeLabel: string }[] = [
  { key: 'system', label: 'System Default', nativeLabel: 'System' },
  { key: 'en', label: 'English', nativeLabel: 'English' },
  { key: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { key: 'sa', label: 'Sanskrit', nativeLabel: 'संस्कृतम्' },
];

/** Resolve the device's preferred language to one we support, falling back to 'en'. */
export function getDeviceLanguage(): string {
  const locales = getLocales();
  if (!locales.length) return 'en';
  const tag = locales[0].languageCode ?? 'en';
  // Map device language to our supported set
  if (tag === 'hi') return 'hi';
  if (tag === 'sa') return 'sa';
  return 'en';
}

/** Resolve user preference ('system' | 'en' | 'hi' | 'sa') to an actual language code. */
export function resolveLanguage(pref: AppLanguage): string {
  return pref === 'system' ? getDeviceLanguage() : pref;
}

/** Lazily load a language bundle and add it to i18next. */
async function loadLanguage(lng: string): Promise<void> {
  if (i18n.hasResourceBundle(lng, 'translation')) return;
  let resources;
  if (lng === 'hi') resources = (await import('./locales/hi')).default;
  else if (lng === 'sa') resources = (await import('./locales/sa')).default;
  else return;
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
