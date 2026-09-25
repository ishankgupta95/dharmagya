/**
 * Scriptures — re-export shim over `hindu-devotional-texts` (v0.4.0+).
 *
 * The library's `scriptures/` module ships two full-text scriptures: the
 * Bhagavad Geeta (18 chapters · 701 shlokas · Devanagari + IAST, no English
 * translation) and the Tulsi Sundarkand (1 chapter · 63 shlokas · Devanagari
 * only). Both surface a bilingual `about` summary. The Durga Saptashati outline
 * lives in `@/config/navratri` — it is a 13-chapter outline + 9-day pāṭha map
 * with no verses, sourced separately, and the scripture index lists it
 * alongside the two library scriptures.
 *
 * This file is the app's import boundary — screens import from
 * `@/config/scriptures`, never the package directly — so the underlying
 * storage can evolve without churn in the UI.
 */
import {
  getAllScriptures,
  type Scripture,
  type ScriptureSlug,
  type ScriptureVerse,
  type Chapter,
  type Bilingual,
} from 'hindu-devotional-texts';

import { sanitizeBilingual } from '@/utils/sanitizeContent';

export type { Scripture, ScriptureSlug, ScriptureVerse, Chapter, Bilingual };

// ─── The library scriptures + lookups ────────────────────────────────────────

function sanitizeScripture(s: Scripture): Scripture {
  if (!s.about) return s;
  return { ...s, about: sanitizeBilingual(s.about) };
}

/** All library scriptures, in registry order (Geeta first, Sundarkand second). */
export const ALL_SCRIPTURES: readonly Scripture[] = getAllScriptures().map(sanitizeScripture);

/** Look up a scripture by slug; `undefined` for an unknown key. */
export function getScriptureBySlug(slug: string | undefined): Scripture | undefined {
  if (!slug) return undefined;
  return ALL_SCRIPTURES.find((s) => s.slug === slug);
}

/**
 * Scriptures tied to a Library deity id — Geeta→krishna, Sundarkand→hanuman.
 * Accepts a raw string so a route param can be passed without first narrowing.
 */
export function getScripturesForDeity(deityId: string): Scripture[] {
  return ALL_SCRIPTURES.filter((s) => s.deity === deityId);
}

// ─── Disclaimer ──────────────────────────────────────────────────────────────

/**
 * App-side accuracy disclaimer for scripture readers. The library documents
 * its scripture citations in its own module docs but exports no constant.
 * This mirrors the tone of `KATHA_DISCLAIMER` / `PUJA_DISCLAIMER`.
 */
export const SCRIPTURE_DISCLAIMER: Bilingual = {
  en: 'Scripture carries centuries of recension and family pronunciation. The Devanagari is the source text; the meaning shown is one rendering among many traditions. Consult a trusted edition or a pandit when studying closely.',
  hi: 'शास्त्र में सदियों के पाठान्तर एवं पारिवारिक उच्चारण की परम्पराएँ हैं। देवनागरी मूल पाठ है; यहाँ दिया गया अर्थ अनेक परम्पराओं में से एक भावार्थ है। गहन अध्ययन हेतु किसी विश्वसनीय संस्करण अथवा पंडित जी से परामर्श करें।',
};

// ─── Index grouping ──────────────────────────────────────────────────────────

/**
 * The scripture index groups its rows so the eight Upanishads don't interleave
 * alphabetically with the epics + Gita (which read as the "core" texts). The
 * group key drives a section header on the index screen; ordering inside each
 * group follows `CORE_ORDER` / the lib registry order. `i18nKey` resolves to
 * `scripture.group.*`.
 */
export type ScriptureGroupKey = 'core' | 'upanishad';

/** Slugs that head the "core" group, in display order (rest fall after). */
const CORE_ORDER: readonly string[] = ['bhagavad-geeta', 'ramcharitmanas', 'sundarkand'];

/** Upanishad slugs end in `-upanishad`; everything else is "core". */
export function scriptureGroupFor(slug: string): ScriptureGroupKey {
  return slug.endsWith('-upanishad') ? 'upanishad' : 'core';
}

export interface ScriptureGroup {
  key: ScriptureGroupKey;
  /** i18n key for the section header. */
  i18nKey: string;
  scriptures: Scripture[];
}

/**
 * Library scriptures split into the two index groups, each internally ordered
 * (core by `CORE_ORDER` then registry order; Upanishads by English title). The
 * Durga Saptashati outline is appended to `core` by the index screen itself
 * (it isn't a library `Scripture`), so it isn't represented here.
 */
export function getScriptureGroups(): ScriptureGroup[] {
  const core = ALL_SCRIPTURES.filter((s) => scriptureGroupFor(s.slug) === 'core')
    .slice()
    .sort((a, b) => {
      const ai = CORE_ORDER.indexOf(a.slug);
      const bi = CORE_ORDER.indexOf(b.slug);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  const upanishads = ALL_SCRIPTURES.filter((s) => scriptureGroupFor(s.slug) === 'upanishad')
    .slice()
    .sort((a, b) => a.titleEnglish.localeCompare(b.titleEnglish));
  return [
    { key: 'core', i18nKey: 'scripture.group.core', scriptures: core },
    { key: 'upanishad', i18nKey: 'scripture.group.upanishad', scriptures: upanishads },
  ];
}
