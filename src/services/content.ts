import {
  getAarti as pkgGetAarti,
  getChalisa as pkgGetChalisa,
  getAllAartis as pkgGetAllAartis,
  getAllChalisas as pkgGetAllChalisas,
  getAllMantras as pkgGetAllMantras,
  getMantra as pkgGetMantra,
  type Deity,
  type Recitation,
  type Chalisa,
  type RecitationVerse,
  type Mantra,
  type MantraSlug,
} from 'hindu-devotional-texts';

import i18n from '@/i18n';
import { ALL_DEITIES } from '@/config/deities';

export type { Recitation, Chalisa, RecitationVerse, Deity, Mantra, MantraSlug };

/** Locales the package ships content in for aartis/chalisas. */
export type ContentLang = 'en' | 'hi';

/** Map our compact `ContentLang` to the keys used inside the package's verse maps. */
const VERSE_KEY: Record<ContentLang, 'english' | 'hindi'> = {
  en: 'english',
  hi: 'hindi',
};

const APP_DEITY_SLUGS = new Set<string>(ALL_DEITIES.map(d => d.id));

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
