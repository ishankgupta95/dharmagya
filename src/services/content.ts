import {
  getAarti as pkgGetAarti,
  getChalisa as pkgGetChalisa,
  getAllAartis as pkgGetAllAartis,
  getAllChalisas as pkgGetAllChalisas,
  type Deity,
  type Recitation,
  type Chalisa,
  type RecitationVerse,
} from 'hindu-devotional-texts';

import { ALL_DEITIES } from '@/config/deities';

export type { Recitation, Chalisa, RecitationVerse, Deity };

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

const SECTION_LABELS: Record<'doha' | 'soratha' | 'chaupai', { en: string; hi: string }> = {
  doha:    { en: 'Doha',    hi: 'दोहा' },
  soratha: { en: 'Soratha', hi: 'सोरठा' },
  chaupai: { en: 'Chaupai', hi: 'चौपाई' },
};

export function chalisaSections(chalisa: Chalisa, lang: ContentLang): ChalisaSection[] {
  const key = VERSE_KEY[lang];
  const sections: ChalisaSection[] = [];
  if (chalisa.openingDoha) {
    sections.push({ type: 'doha', label: SECTION_LABELS.doha[lang], verses: chalisa.openingDoha[key].map(v => v.text) });
  }
  if (chalisa.soratha) {
    sections.push({ type: 'soratha', label: SECTION_LABELS.soratha[lang], verses: chalisa.soratha[key].map(v => v.text) });
  }
  sections.push({ type: 'chaupai', label: SECTION_LABELS.chaupai[lang], verses: chalisa.chaupai[key].map(v => v.text) });
  if (chalisa.closingDoha) {
    sections.push({ type: 'doha', label: SECTION_LABELS.doha[lang], verses: chalisa.closingDoha[key].map(v => v.text) });
  }
  return sections;
}
