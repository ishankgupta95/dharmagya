import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './locales/en';
import hi from './locales/hi';

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

// eslint-disable-next-line import/no-named-as-default-member -- `i18n` is i18next's singleton and the named `use` export is that same instance's bound method (i18next binds its members in the constructor), so the instance call is the intended one.
i18n.use(initReactI18next).init({
  // Both supported bundles are eager-loaded so reader screens can resolve
  // labels against either language regardless of the active app language —
  // the in-screen lang toggle on aarti/chalisa needs synchronous access.
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: deviceLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

/** Change the active language, loading the bundle if needed. */
export async function changeLanguage(lng: string): Promise<void> {
  await loadLanguage(lng);
  // eslint-disable-next-line import/no-named-as-default-member -- same singleton as above; the named `changeLanguage` export is this instance's bound method, and this module's own `changeLanguage` wrapper needs the instance call, not a self-import.
  await i18n.changeLanguage(lng);
}

export default i18n;
