import {
  getAarti as pkgGetAarti,
  getChalisa as pkgGetChalisa,
  getAllAartis as pkgGetAllAartis,
  getAllChalisas as pkgGetAllChalisas,
  getAllMantras as pkgGetAllMantras,
  getMantra as pkgGetMantra,
  getAshtottara as pkgGetAshtottara,
  getAllPrayers as pkgGetAllPrayers,
  getAllStotras as pkgGetAllStotras,
  getStotra as pkgGetStotra,
  getStotrasForDeity as pkgGetStotrasForDeity,
  getAllSuktas as pkgGetAllSuktas,
  getSukta as pkgGetSukta,
  getSuktasForDeity as pkgGetSuktasForDeity,
  getAllSahasranamas as pkgGetAllSahasranamas,
  getSahasranama as pkgGetSahasranama,
  type Deity,
  type Recitation,
  type Chalisa,
  type RecitationVerse,
  type Mantra,
  type MantraSlug,
  type Ashtottara,
  type AshtottaraName,
  type NamavaliName,
  type Prayer,
  type PrayerOccasion,
  type Stotra,
  type StotraSlug,
  type Sukta,
  type SuktaSlug,
  type SuktaSection,
  type Sahasranama,
  type SahasranamaSection,
} from 'hindu-devotional-texts';

import i18n from '@/i18n';
import { ALL_DEITIES } from '@/config/deities';
import { poojafy, sanitizeBilingual } from '@/utils/sanitizeContent';

export type {
  Recitation,
  Chalisa,
  RecitationVerse,
  Deity,
  Mantra,
  MantraSlug,
  Ashtottara,
  AshtottaraName,
  NamavaliName,
  Prayer,
  PrayerOccasion,
  Stotra,
  StotraSlug,
  Sukta,
  SuktaSlug,
  SuktaSection,
  Sahasranama,
  SahasranamaSection,
};

/** Locales the package ships content in for aartis/chalisas. */
export type ContentLang = 'en' | 'hi';

/** Map our compact `ContentLang` to the keys used inside the package's verse maps. */
const VERSE_KEY: Record<ContentLang, 'english' | 'hindi'> = {
  en: 'english',
  hi: 'hindi',
};

const APP_DEITY_SLUGS = new Set<string>(ALL_DEITIES.map(d => d.id));

/**
 * Prepare a library `about` blurb for display: strip the package's
 * reviewer-facing citation artifacts, then respell the English face to the
 * app's "Pooja" (many blurbs describe the archana step of a pooja, or name the
 * festival pooja the litany belongs to). The Devanagari `hi` face is untouched,
 * and `poojafy` matches plain ASCII only, so IAST passes through unchanged.
 *
 * Deliberately NOT applied to aarti/chalisa verses: `verses.english` there is
 * romanised Hindi lyric, not English prose, and respelling a recited line would
 * put the reader out of step with what is being sung.
 */
function sanitizeAbout<T extends { en: string; hi: string }>(about: T): T {
  const b = sanitizeBilingual(about);
  return { ...b, en: poojafy(b.en) };
}

/** Aartis available in the app (filtered to our roster). */
export function getAllAppAartis(): Recitation[] {
  return pkgGetAllAartis().filter(a => APP_DEITY_SLUGS.has(a.deity));
}

/** Chalisas available in the app (filtered to our roster). */
export function getAllAppChalisas(): Chalisa[] {
  return pkgGetAllChalisas().filter(c => APP_DEITY_SLUGS.has(c.deity));
}

export function getAartiForDeity(deity: string): Recitation | undefined {
  if (!APP_DEITY_SLUGS.has(deity)) return undefined;
  return pkgGetAarti(deity as Deity);
}

export function getChalisaForDeity(deity: string): Chalisa | undefined {
  if (!APP_DEITY_SLUGS.has(deity)) return undefined;
  return pkgGetChalisa(deity as Deity);
}

/** Pick the right title for a given content language. */
export function titleFor(item: { titleEnglish: string; titleHindi: string }, lang: ContentLang): string {
  return lang === 'hi' ? item.titleHindi : item.titleEnglish;
}

/** Flatten Recitation verses for a given language to plain string lines. */
export function aartiVerses(aarti: Recitation, lang: ContentLang): string[] {
  return aarti.verses[VERSE_KEY[lang]].map(v => v.text);
}

/** Section helpers for Chalisa rendering. Keeps doha/soratha/chaupai order stable. */
export interface ChalisaSection {
  type: 'doha' | 'soratha' | 'chaupai';
  /** Localized label shown above the section. */
  label: string;
  verses: string[];
}

// Reader section labels live in the i18n bundle (reader.dohaLabel etc.) so the
// chalisa toggle's per-language label follows the same translation source as
// the rest of the reader (Verse N kicker, refrain tag, etc.). The fixed-T call
// pins the label to the in-screen lang toggle rather than the global app lang.
function sectionLabel(type: 'doha' | 'soratha' | 'chaupai', lang: ContentLang): string {
  const key = type === 'doha' ? 'reader.dohaLabel'
    : type === 'soratha' ? 'reader.sorathaLabel'
    : 'reader.chaupaiLabel';
  return i18n.getFixedT(lang, 'translation')(key);
}

export function chalisaSections(chalisa: Chalisa, lang: ContentLang): ChalisaSection[] {
  const key = VERSE_KEY[lang];
  const sections: ChalisaSection[] = [];
  if (chalisa.openingDoha) {
    sections.push({ type: 'doha', label: sectionLabel('doha', lang), verses: chalisa.openingDoha[key].map(v => v.text) });
  }
  if (chalisa.soratha) {
    sections.push({ type: 'soratha', label: sectionLabel('soratha', lang), verses: chalisa.soratha[key].map(v => v.text) });
  }
  sections.push({ type: 'chaupai', label: sectionLabel('chaupai', lang), verses: chalisa.chaupai[key].map(v => v.text) });
  if (chalisa.closingDoha) {
    sections.push({ type: 'doha', label: sectionLabel('doha', lang), verses: chalisa.closingDoha[key].map(v => v.text) });
  }
  return sections;
}

// ─── Mantras ─────────────────────────────────────────────────────────────────

/** Mantras available in the app. A mantra without a `deity` is universal
 *  (Gayatri, Maha Mrityunjaya etc.) and always included. Deity-tagged mantras
 *  are filtered to the app's roster so adding/removing a deity in
 *  [config/deities.ts](src/config/deities.ts) flows through automatically. */
export function getAllAppMantras(): Mantra[] {
  return pkgGetAllMantras().filter(m => !m.deity || APP_DEITY_SLUGS.has(m.deity));
}

/** Look up a mantra by slug. Returns `undefined` if the slug doesn't exist
 *  (typed slugs make this rare, but the picker may receive a stale slug from
 *  history). */
export function getMantraBySlug(slug: string): Mantra | undefined {
  try {
    return pkgGetMantra(slug as MantraSlug);
  } catch {
    return undefined;
  }
}

/** Pick the right meaning for a given content language. */
export function mantraMeaning(mantra: Mantra, lang: ContentLang): string {
  return lang === 'hi' ? mantra.meaning.hi : mantra.meaning.en;
}

// ─── Ashtottara (108-name litanies) ───────────────────────────────────────────

/** The 108-name archana litany for a deity, or `undefined`. Two roster deities
 *  have none by design (vaishno-devi uses the Durga ashtottara; khatu-shyam has
 *  no canonical 108-list), so callers must null-check before rendering. The
 *  `about` blurb goes through the same boundary sanitiser as the stotra /
 *  sukta / sahasranama helpers below — most of these blurbs name the pooja the
 *  litany is recited at, in the library's "puja" spelling. */
export function getAshtottaraForDeity(deity: string): Ashtottara | undefined {
  if (!APP_DEITY_SLUGS.has(deity)) return undefined;
  const a = pkgGetAshtottara(deity as Deity);
  return a ? { ...a, about: sanitizeAbout(a.about) } : a;
}

// ─── Daily prayers (Nitya Karma) ──────────────────────────────────────────────

/** Daily nitya-karma prayers. Universal prayers (no deity) are always included;
 *  deity-tagged ones are filtered to the app's roster so they track
 *  [config/deities.ts](src/config/deities.ts) automatically. */
export function getAllAppPrayers(): Prayer[] {
  return pkgGetAllPrayers().filter(p => !p.deity || APP_DEITY_SLUGS.has(p.deity));
}

/** Pick the right meaning for a given content language. */
export function prayerMeaning(prayer: Prayer, lang: ContentLang): string {
  return lang === 'hi' ? prayer.meaning.hi : prayer.meaning.en;
}

// ─── Stotras / Suktas / Sahasranama (0.7.0 verse-text content) ─────────────────

/** Include an item iff it's universal (no deity tag) or any tagged deity is in
 *  the app roster. Mirrors the mantra/prayer roster discipline but also reads
 *  the lib's `deities[]` (some stotras are co-dedicated). */
function deityTagInRoster(item: { deity?: string; deities?: readonly string[] }): boolean {
  const tagged = [item.deity, ...(item.deities ?? [])].filter(Boolean) as string[];
  if (tagged.length === 0) return true;
  return tagged.some((d) => APP_DEITY_SLUGS.has(d));
}

// Stotras / ashtakams — slug-keyed hymns (Shiva Tandava, Bajrang Baan, …).
export function getAllAppStotras(): Stotra[] {
  return pkgGetAllStotras().filter(deityTagInRoster).map((s) => ({ ...s, about: sanitizeAbout(s.about) }));
}

export function getStotraBySlug(slug: string): Stotra | undefined {
  try {
    const s = pkgGetStotra(slug as StotraSlug);
    return s ? { ...s, about: sanitizeAbout(s.about) } : undefined;
  } catch {
    return undefined;
  }
}

export function getStotrasForDeity(deity: string): Stotra[] {
  if (!APP_DEITY_SLUGS.has(deity)) return [];
  return pkgGetStotrasForDeity(deity as Deity).map((s) => ({ ...s, about: sanitizeAbout(s.about) }));
}

// Suktas — Vedic hymns (Sri Suktam, Purusha Suktam, Sri Rudram, …); sectioned.
export function getAllAppSuktas(): Sukta[] {
  return pkgGetAllSuktas().filter(deityTagInRoster).map((s) => ({ ...s, about: sanitizeAbout(s.about) }));
}

export function getSuktaBySlug(slug: string): Sukta | undefined {
  try {
    const s = pkgGetSukta(slug as SuktaSlug);
    return s ? { ...s, about: sanitizeAbout(s.about) } : undefined;
  } catch {
    return undefined;
  }
}

export function getSuktasForDeity(deity: string): Sukta[] {
  if (!APP_DEITY_SLUGS.has(deity)) return [];
  return pkgGetSuktasForDeity(deity as Deity).map((s) => ({ ...s, about: sanitizeAbout(s.about) }));
}

// Sahasranama — 1000-name litanies (Vishnu, Lalita). Deity-keyed in the lib.
export function getAllAppSahasranamas(): Sahasranama[] {
  return pkgGetAllSahasranamas()
    .filter((s) => APP_DEITY_SLUGS.has(s.deity))
    .map((s) => ({ ...s, about: sanitizeAbout(s.about) }));
}

export function getSahasranamaBySlug(slug: string): Sahasranama | undefined {
  const s = pkgGetAllSahasranamas().find((x) => x.slug === slug);
  return s ? { ...s, about: sanitizeAbout(s.about) } : undefined;
}

export function getSahasranamaForDeity(deity: string): Sahasranama | undefined {
  if (!APP_DEITY_SLUGS.has(deity)) return undefined;
  const s = pkgGetSahasranama(deity as Deity);
  return s ? { ...s, about: sanitizeAbout(s.about) } : undefined;
}
